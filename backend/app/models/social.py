import logging
from pymongo import ASCENDING, DESCENDING, IndexModel

logger = logging.getLogger("hrms.social")

async def setup_social_indexes(db):
    """Setup MongoDB indexes for all Social Automation collections."""
    try:
        # 1. Accounts
        await db["social_ig_accounts"].create_indexes([
            IndexModel([("ig_account_id", ASCENDING)], unique=True, name="uniq_ig_account_id"),
            IndexModel([("username_lc", ASCENDING)], unique=True, name="uniq_username_lc"),
            IndexModel([("is_active", ASCENDING)], name="idx_is_active"),
        ])

        # 2. Keywords
        await db["social_keywords"].create_indexes([
            IndexModel([("ig_account_id", ASCENDING), ("is_active", ASCENDING)], name="idx_account_active"),
            IndexModel(
                [("ig_account_id", ASCENDING), ("keyword_norm", ASCENDING), ("media_id", ASCENDING)],
                unique=True,
                partialFilterExpression={"is_active": True},
                name="uniq_active_account_keyword_media"
            ),
        ])

        # 3. Pending DMs (Compound unique + TTL)
        await db["social_pending_dms"].create_indexes([
            IndexModel([("ig_account_id", ASCENDING), ("igsid", ASCENDING)], unique=True, name="uniq_account_igsid"),
            IndexModel([("expire_at", ASCENDING)], expireAfterSeconds=0, name="ttl_expire_at"),
        ])

        # 4. Dedupe (TTL 24 hours)
        await db["social_dedupe"].create_indexes([
            IndexModel([("created_at", ASCENDING)], expireAfterSeconds=86400, name="ttl_dedupe_24h"),
        ])

        # 5. Event Logs (Auto-deletion via TTL on expire_at)
        await db["social_event_logs"].create_indexes([
            IndexModel([("ts", DESCENDING)], name="idx_ts_desc"),
            IndexModel([("ig_account_id", ASCENDING), ("ts", DESCENDING)], name="idx_account_ts"),
            IndexModel([("type", ASCENDING), ("ts", DESCENDING)], name="idx_type_ts"),
            IndexModel([("expire_at", ASCENDING)], expireAfterSeconds=0, name="ttl_logs_expire_at"),
        ])

        # 6. Brands
        await db["social_brands"].create_indexes([
            IndexModel([("brand_id", ASCENDING)], unique=True, name="uniq_brand_id"),
            IndexModel([("is_active", ASCENDING)], name="idx_brand_active"),
        ])

        # 7. AI Jobs (TTL on expire_at)
        await db["social_jobs"].create_indexes([
            IndexModel([("created_at", DESCENDING)], name="idx_job_created"),
            IndexModel([("created_by", ASCENDING), ("created_at", DESCENDING)], name="idx_job_user"),
            IndexModel([("expire_at", ASCENDING)], expireAfterSeconds=0, name="ttl_jobs_expire_at"),
        ])

        # 8. Saved Reel Scripts
        await db["social_scripts"].create_indexes([
            IndexModel([("created_by", ASCENDING), ("created_at", DESCENDING)], name="idx_scripts_user"),
            IndexModel([("brand_id", ASCENDING), ("created_at", DESCENDING)], name="idx_scripts_brand"),
        ])

        logger.info("Social Automation MongoDB indexes ensured successfully.")
    except Exception as e:
        logger.warning(f"Social Automation index initialization notice: {e}")
