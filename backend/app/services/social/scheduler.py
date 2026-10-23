import asyncio
import logging
import os
import time
from datetime import datetime, timedelta
import pytz
from app.repository.social import (
    SocialAccountRepository,
    SocialEventLogRepository,
    SocialJobRepository,
    SocialPendingDmRepository,
    SocialLockRepository,
    SocialSettingsRepository,
)
from app.utils.social_crypto import decrypt_social_token, encrypt_social_token
from app.services.social.instagram_client import InstagramClient
from app.services.social.utils import mask

logger = logging.getLogger("hrms.social")

class SocialScheduler:
    """Background scheduler for token refresh, pending DM sweeps, and log retention cleanup."""
    _tasks: list = []

    @classmethod
    def start_scheduler(cls):
        """Called inside FastAPI lifespan startup."""
        cls.stop_scheduler()
        cls._tasks.append(asyncio.create_task(cls._daily_token_refresh_loop()))
        cls._tasks.append(asyncio.create_task(cls._hourly_log_cleanup_loop()))
        cls._tasks.append(asyncio.create_task(cls._pending_dm_sweep_loop()))
        logger.info("Social Automation background schedulers started.")

    @classmethod
    def stop_scheduler(cls):
        """Called inside FastAPI lifespan shutdown."""
        for t in cls._tasks:
            if not t.done():
                t.cancel()
        cls._tasks.clear()

    @classmethod
    async def _daily_token_refresh_loop(cls):
        """Daily check at 04:00 IST for accounts needing token refresh."""
        tz_kolkata = pytz.timezone("Asia/Kolkata")
        while True:
            try:
                now_kolkata = datetime.now(tz_kolkata)
                # Next run at 04:00 IST
                target_today = now_kolkata.replace(hour=4, minute=0, second=0, microsecond=0)
                if now_kolkata >= target_today:
                    target_next = target_today + timedelta(days=1)
                else:
                    target_next = target_today

                seconds_to_wait = (target_next - now_kolkata).total_seconds()
                await asyncio.sleep(max(10.0, seconds_to_wait))

                # Acquire distributed lock so only one worker runs the daily refresh
                locked = await SocialLockRepository.acquire_lock("daily_token_refresh", duration_seconds=1800)
                if locked:
                    logger.info("Starting scheduled daily Instagram token refresh...")
                    await cls.refresh_due_accounts()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in daily_token_refresh_loop: {e}")
                await asyncio.sleep(60.0)

    @classmethod
    async def refresh_due_accounts(cls) -> list:
        """Refreshes tokens for accounts whose tokens are >= 50 days old or never refreshed."""
        accounts = await SocialAccountRepository.get_all(active_only=True)
        now = datetime.utcnow()
        results = []

        for acct in accounts:
            token_updated_at = acct.get("token_updated_at")
            is_due = False
            if not token_updated_at:
                is_due = True
            else:
                days_old = (now - token_updated_at).days
                if days_old >= 50:
                    is_due = True

            if not is_due:
                continue

            raw_token = decrypt_social_token(acct.get("access_token_enc", ""))
            if not raw_token:
                results.append({"username": acct.get("username"), "status": "skipped_no_token"})
                continue

            ok, new_token, hint = await InstagramClient.refresh_access_token(raw_token)
            if ok and new_token:
                enc = encrypt_social_token(new_token)
                await SocialAccountRepository.update(acct["id"], {
                    "access_token_enc": enc,
                    "token_last4": new_token[-4:] if len(new_token) >= 4 else "****",
                    "token_updated_at": now,
                    "last_refresh_status": "ok",
                })
                await SocialEventLogRepository.log_event(
                    type_="token_refreshed",
                    status_="ok",
                    message=f"Refreshed long-lived Instagram token for @{acct.get('username')}",
                    ig_account_id=acct.get("ig_account_id"),
                    username=acct.get("username")
                )
                results.append({"username": acct.get("username"), "status": "ok"})
            else:
                await SocialAccountRepository.update(acct["id"], {
                    "last_refresh_status": hint,
                })
                await SocialEventLogRepository.log_event(
                    type_="token_refresh_failed",
                    status_="error",
                    message=f"Failed to refresh token for @{acct.get('username')}: {hint}",
                    ig_account_id=acct.get("ig_account_id"),
                    username=acct.get("username"),
                    hint=hint,
                    level="warn"
                )
                results.append({"username": acct.get("username"), "status": "failed", "hint": hint})

            # 1 second spacing between refreshes
            await asyncio.sleep(1.0)

        return results

    @classmethod
    async def _hourly_log_cleanup_loop(cls):
        """Hourly safety net to clean up expired event logs, AI jobs, and temp files."""
        while True:
            try:
                await asyncio.sleep(3600.0)
                now = datetime.utcnow()

                # Clean up expired temp files under backend/uploads/social_tmp/
                tmp_dir = os.path.join(os.getcwd(), "uploads", "social_tmp")
                if os.path.exists(tmp_dir):
                    one_hour_ago = time.time() - 3600
                    for filename in os.listdir(tmp_dir):
                        file_path = os.path.join(tmp_dir, filename)
                        try:
                            if os.path.isfile(file_path) and os.path.getmtime(file_path) < one_hour_ago:
                                os.remove(file_path)
                        except Exception:
                            pass

                # Database safety cleanup
                log_col = await SocialEventLogRepository.get_collection()
                deleted_logs = await log_col.delete_many({"expire_at": {"$lte": now}})

                job_col = await SocialJobRepository.get_collection()
                deleted_jobs = await job_col.delete_many({"expire_at": {"$lte": now}})

                if deleted_logs.deleted_count > 0 or deleted_jobs.deleted_count > 0:
                    logger.info(f"Log retention sweep: deleted {deleted_logs.deleted_count} logs, {deleted_jobs.deleted_count} jobs.")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in _hourly_log_cleanup_loop: {e}")

    @classmethod
    async def _pending_dm_sweep_loop(cls):
        """Every 5 minutes, sweeps expired pending DM records."""
        while True:
            try:
                await asyncio.sleep(300.0)
                now = datetime.utcnow()
                pending_col = await SocialPendingDmRepository.get_collection()
                res = await pending_col.delete_many({"expire_at": {"$lte": now}})
                if res.deleted_count > 0:
                    logger.info(f"Pending DM sweep: expired {res.deleted_count} unresolved rows.")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in _pending_dm_sweep_loop: {e}")
