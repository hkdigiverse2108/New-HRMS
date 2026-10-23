import logging
import random
import re
from typing import Dict, Any, List
from datetime import datetime
from app.config import settings
from app.repository.social import (
    SocialAccountRepository,
    SocialKeywordRepository,
    SocialPendingDmRepository,
    SocialDedupeRepository,
    SocialEventLogRepository,
    SocialSettingsRepository,
)
from app.utils.social_crypto import decrypt_social_token
from app.services.social.instagram_client import InstagramClient
from app.services.social.keyword_matcher import match_keyword_rules
from app.services.social.utils import clean_id, mask

logger = logging.getLogger("hrms.social")

DEFAULT_PUBLIC_REPLIES = [
    "Check your DM 📩",
    "Just sent you a DM 📩",
    "Done! Check your inbox 📩",
    "Sent! Have a look at your DMs 📩",
]

TYPED_CONFIRMATIONS = {
    "i am following", "im following", "following", "followed",
    "i followed", "i have followed", "followed you", "followed us", "done"
}

def extract_comments_from_payload(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    comments = []
    entries = payload.get("entry", [])
    for entry in entries:
        account_ig_id = str(entry.get("id", "")).strip()
        for change in entry.get("changes", []):
            if change.get("field") == "comments":
                val = change.get("value", {})
                from_u = val.get("from", {})
                comments.append({
                    "account_ig_id": account_ig_id,
                    "comment_id": str(val.get("id", "")).strip(),
                    "comment_text": val.get("text", ""),
                    "sender_id": str(from_u.get("id", "")).strip(),
                    "sender_username": from_u.get("username", ""),
                    "media_id": str(val.get("media", {}).get("id", "")).strip(),
                    "parent_id": str(val.get("parent_id", "")).strip(),
                })
    return comments

def extract_taps_from_payload(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    taps = []
    entries = payload.get("entry", [])
    for entry in entries:
        account_ig_id = str(entry.get("id", "")).strip()
        for msg in entry.get("messaging", []):
            sender_id = str(msg.get("sender", {}).get("id", "")).strip()
            postback = msg.get("postback", {})
            payload_str = postback.get("payload", "")
            taps.append({
                "account_ig_id": account_ig_id,
                "sender_id": sender_id,
                "payload": payload_str,
                "title": postback.get("title", ""),
                "message_text": msg.get("message", {}).get("text", "")
            })
    return taps

class DmEngine:
    """Core Instagram Comment-to-DM and Follow-Gate automation engine."""

    @classmethod
    async def handle_payload(cls, body: Dict[str, Any]):
        """Main entry point called by BackgroundTasks from the webhook receiver."""
        try:
            entries = body.get("entry", [])
            if not entries and isinstance(body, dict) and "field" in body:
                # Meta test payload format
                await cls._handle_single_comment_change("0", body, is_test=True)
                return

            for entry in entries:
                entry_id = str(entry.get("id", "")).strip()

                # 1. Check if this is a messaging / postback event
                messaging_events = entry.get("messaging", [])
                if messaging_events:
                    for msg_event in messaging_events:
                        await cls._handle_messaging_event(entry_id, msg_event)
                    continue

                # 2. Check if this is a changes / comment event
                changes = entry.get("changes", [])
                for change in changes:
                    await cls._handle_single_comment_change(entry_id, change)

        except Exception as e:
            logger.exception(f"Unhandled error in DmEngine handle_payload: {e}")
            await SocialEventLogRepository.log_event(
                type_="comment_skipped",
                status_="error",
                message=f"Fatal exception during payload processing: {mask(str(e))}",
                level="error"
            )

    @classmethod
    async def _handle_single_comment_change(cls, entry_id: str, change: dict, is_test: bool = False):
        """Processes one comment change event."""
        field = change.get("field")
        value = change.get("value", {})
        if field and field != "comments":
            return

        comment_id = str(value.get("id", "")).strip()
        comment_text = value.get("text", "")
        from_user = value.get("from", {})
        from_id = str(from_user.get("id", "")).strip()
        from_username = from_user.get("username", "")
        parent_id = str(value.get("parent_id", "")).strip()
        self_ig_id = str(from_user.get("self_ig_scoped_id", "")).strip()
        media_id = str(value.get("media", {}).get("id", "")).strip()

        # Is Meta dashboard test payload?
        if not entry_id or entry_id == "0":
            is_test = True

        # Validation & loop protection
        if not comment_id or not isinstance(comment_text, str) or not comment_text.strip():
            return

        # Loop protection 1: Never reply to own replies (sub-comments by the business account)
        if parent_id and (from_id == entry_id or self_ig_id):
            return

        # Loop protection 2: Ignore non-test replies
        if parent_id and not is_test:
            return

        # Loop protection 3: Ignore own top-level comments unless SOCIAL_ALLOW_SELF_COMMENTS is enabled
        effective_settings = await SocialSettingsRepository.get_effective_settings()
        allow_self = effective_settings.get("SOCIAL_ALLOW_SELF_COMMENTS", getattr(settings, "SOCIAL_ALLOW_SELF_COMMENTS", False))
        if (from_id == entry_id or (self_ig_id and self_ig_id == entry_id)) and not allow_self and not is_test:
            return

        # Deduplication via MongoDB unique _id
        if not is_test:
            acquired = await SocialDedupeRepository.try_acquire(f"c:{comment_id}")
            if not acquired:
                return

        # Resolve Account
        account = await SocialAccountRepository.get_by_ig_id(entry_id)
        if not account and not is_test:
            await SocialEventLogRepository.log_event(
                type_="comment_skipped",
                status_="skip",
                message=f"No configured Instagram account for entry ID {entry_id}",
                ig_account_id=entry_id,
                username=from_username,
                level="warn"
            )
            return

        if account and not account.get("is_active", True) and not is_test:
            return

        account_username = account.get("username", "") if account else from_username
        access_token_enc = account.get("access_token_enc", "") if account else ""
        raw_token = decrypt_social_token(access_token_enc)

        if not raw_token and not is_test:
            await SocialEventLogRepository.log_event(
                type_="comment_skipped",
                status_="error",
                message=f"Account @{account_username} has no valid decrypted token",
                ig_account_id=entry_id,
                username=account_username,
                level="error"
            )
            return

        # Update last webhook activity
        if account:
            await SocialAccountRepository.update(account["id"], {"last_webhook_at": datetime.utcnow()})

        # Match keyword
        rules = await SocialKeywordRepository.get_active_rules_for_account(entry_id) if account else []
        matched_rule, reason = match_keyword_rules(comment_text, media_id, rules)

        if not matched_rule:
            await SocialEventLogRepository.log_event(
                type_="no_match",
                status_="ok",
                message=f"Comment '{mask(comment_text, 40)}' by @{from_username}: {reason}",
                ig_account_id=entry_id,
                username=account_username,
                detail={"comment_id": comment_id, "media_id": media_id, "from": from_username}
            )
            return

        # Increment hit counter
        if matched_rule.get("id"):
            await SocialKeywordRepository.increment_hit(matched_rule["id"])

        await SocialEventLogRepository.log_event(
            type_="matched",
            status_="ok",
            message=f"Matched keyword '{matched_rule.get('keyword')}' for @{from_username}",
            ig_account_id=entry_id,
            username=account_username,
            detail={"rule_id": matched_rule.get("id"), "keyword": matched_rule.get("keyword")}
        )

        # 4. Public reply (Always attempt if non-test)
        replies_pool = [
            matched_rule.get("comment_reply1"),
            matched_rule.get("comment_reply2"),
            matched_rule.get("comment_reply3"),
        ]
        valid_replies = [r.strip() for r in replies_pool if r and isinstance(r, str) and r.strip()]
        chosen_reply = random.choice(valid_replies) if valid_replies else random.choice(DEFAULT_PUBLIC_REPLIES)

        if not is_test:
            pub_ok, pub_data, pub_hint = await InstagramClient.post_public_reply(comment_id, chosen_reply, raw_token)
            if pub_ok:
                await SocialEventLogRepository.log_event(
                    type_="public_reply_sent",
                    status_="ok",
                    message=f"Public reply posted to comment {comment_id}: '{chosen_reply}'",
                    ig_account_id=entry_id,
                    username=account_username
                )
            else:
                await SocialEventLogRepository.log_event(
                    type_="public_reply_failed",
                    status_="error",
                    message=f"Public reply failed: {pub_hint}",
                    ig_account_id=entry_id,
                    username=account_username,
                    detail=pub_data,
                    hint=pub_hint,
                    level="warn"
                )

        # 5. DM decision
        require_follow = matched_rule.get("require_follow", True)
        rule_message = matched_rule.get("message", "")

        is_following = False
        if require_follow and from_id and not is_test:
            is_following = await InstagramClient.is_user_following_business(from_id, raw_token)

        # 6. If follow is not required OR user is already following -> Send DM
        if not require_follow or is_following or is_test:
            dm_ok, dm_data, dm_hint = await InstagramClient.send_private_reply_to_comment(comment_id, rule_message, raw_token)
            if dm_ok:
                await SocialEventLogRepository.log_event(
                    type_="dm_sent",
                    status_="ok",
                    message=f"Private DM sent to @{from_username} for comment {comment_id}",
                    ig_account_id=entry_id,
                    username=account_username,
                    detail={"keyword": matched_rule.get("keyword")}
                )
            else:
                await SocialEventLogRepository.log_event(
                    type_="dm_failed",
                    status_="error",
                    message=f"Failed to send DM to comment {comment_id}: {dm_hint}",
                    ig_account_id=entry_id,
                    username=account_username,
                    detail=dm_data,
                    hint=dm_hint,
                    level="error"
                )
            return

        # 7. Follow gate: User is not following -> Send follow gate button template
        gate_ok, gate_data, gate_hint = await InstagramClient.send_follow_gate_template(
            recipient_target={"comment_id": comment_id},
            username=account_username,
            access_token=raw_token
        )

        if gate_ok:
            recipient_id = str(gate_data.get("recipient_id", "")).strip()
            # Store pending DM keyed by (ig_account_id, igsid)
            if recipient_id:
                pending_ttl = effective_settings.get("pending_ttl_minutes", 10)
                await SocialPendingDmRepository.store_pending({
                    "ig_account_id": entry_id,
                    "igsid": recipient_id,
                    "message": rule_message,
                    "keyword": matched_rule.get("keyword", ""),
                    "comment_id": comment_id,
                    "media_id": media_id,
                    "username": from_username,
                    "ttl_minutes": pending_ttl,
                })
                await SocialEventLogRepository.log_event(
                    type_="gate_sent",
                    status_="ok",
                    message=f"Follow-gate template sent to @{from_username} (stored pending DM for IGSID ...{recipient_id[-4:]})",
                    ig_account_id=entry_id,
                    username=account_username,
                    detail={"igsid": recipient_id, "keyword": matched_rule.get("keyword")}
                )
        else:
            await SocialEventLogRepository.log_event(
                type_="gate_failed",
                status_="error",
                message=f"Failed to send follow-gate button template: {gate_hint}",
                ig_account_id=entry_id,
                username=account_username,
                detail=gate_data,
                hint=gate_hint,
                level="error"
            )

    @classmethod
    async def _handle_messaging_event(cls, entry_id: str, msg_event: dict):
        """Processes tap / postback or typed confirmation from Instagram Direct."""
        sender = msg_event.get("sender", {})
        sender_id = str(sender.get("id", "")).strip()
        recipient = msg_event.get("recipient", {})
        mid = str(msg_event.get("message", {}).get("mid", "") or msg_event.get("postback", {}).get("mid", "")).strip()

        # Ignore echoes and own events
        if msg_event.get("message", {}).get("is_echo") or sender_id == entry_id:
            return

        # Determine confirmation
        postback_payload = msg_event.get("postback", {}).get("payload", "")
        quick_reply_payload = msg_event.get("message", {}).get("quick_reply", {}).get("payload", "")
        text_msg = msg_event.get("message", {}).get("text", "")

        is_confirmation = False
        via = ""
        if postback_payload == "IM_FOLLOWING" or quick_reply_payload == "IM_FOLLOWING":
            is_confirmation = True
            via = "postback" if postback_payload else "quick_reply"
        elif text_msg and isinstance(text_msg, str):
            clean_text = re.sub(r"[^a-zA-Z\s]", " ", text_msg).strip().lower()
            clean_text = re.sub(r"\s+", " ", clean_text)
            if clean_text in TYPED_CONFIRMATIONS:
                is_confirmation = True
                via = "typed"

        if not is_confirmation:
            return

        # Deduplicate messaging events
        if mid:
            acquired = await SocialDedupeRepository.try_acquire(f"m:{mid}")
            if not acquired:
                return

        # Resolve Account
        account = await SocialAccountRepository.get_by_ig_id(entry_id)
        if not account or not account.get("is_active", True):
            return

        account_username = account.get("username", "")
        raw_token = decrypt_social_token(account.get("access_token_enc", ""))
        if not raw_token:
            return

        # Lookup pending DM
        pending_row = await SocialPendingDmRepository.get_pending(entry_id, sender_id)
        if not pending_row:
            return

        # Check TTL
        now = datetime.utcnow()
        expire_at = pending_row.get("expire_at")
        if expire_at and now >= expire_at:
            await SocialPendingDmRepository.delete_pending(entry_id, sender_id)
            await SocialEventLogRepository.log_event(
                type_="pending_expired",
                status_="skip",
                message=f"Pending DM for IGSID ...{sender_id[-4:]} expired before confirmation",
                ig_account_id=entry_id,
                username=account_username
            )
            return

        # Re-check follow status
        is_now_following = await InstagramClient.is_user_following_business(sender_id, raw_token)

        if is_now_following:
            # Send DM by IGSID
            send_ok, send_data, send_hint = await InstagramClient.send_direct_message_by_igsid(
                sender_id, pending_row["message"], raw_token
            )
            if send_ok:
                await SocialPendingDmRepository.delete_pending(entry_id, sender_id)
                await SocialEventLogRepository.log_event(
                    type_="pending_sent",
                    status_="ok",
                    message=f"Pending DM released via {via} to IGSID ...{sender_id[-4:]} (user is following)",
                    ig_account_id=entry_id,
                    username=account_username,
                    detail={"keyword": pending_row.get("keyword")}
                )
            else:
                await SocialEventLogRepository.log_event(
                    type_="dm_failed",
                    status_="error",
                    message=f"Failed to release pending DM to IGSID ...{sender_id[-4:]}: {send_hint}",
                    ig_account_id=entry_id,
                    username=account_username,
                    detail=send_data,
                    hint=send_hint,
                    level="error"
                )
        else:
            # User tapped but still not following: Re-send follow-gate by IGSID, keep row untouched
            await InstagramClient.send_follow_gate_template(
                recipient_target={"id": sender_id},
                username=account_username,
                access_token=raw_token
            )
            await SocialEventLogRepository.log_event(
                type_="gate_sent",
                status_="ok",
                message=f"User tapped {via} but is still not following. Re-sent gate to IGSID ...{sender_id[-4:]}",
                ig_account_id=entry_id,
                username=account_username
            )
