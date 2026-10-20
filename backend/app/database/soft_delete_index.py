async def ensure_active_unique_index(collection, keys):
    """Unique index that only covers non-deleted docs, so a soft-deleted name can be reused.

    `keys` is a list of (field, direction). Legacy docs without `is_deleted` are backfilled
    first because partial indexes can't express "field missing".
    """
    await collection.update_many({"is_deleted": {"$exists": False}}, {"$set": {"is_deleted": False}})
    for name, info in (await collection.index_information()).items():
        if name != "_id_" and list(info.get("key", [])) == [(k, d) for k, d in keys] and "partialFilterExpression" not in info:
            await collection.drop_index(name)
    await collection.create_index(
        keys, unique=True, partialFilterExpression={"is_deleted": False}, name="uniq_active_" + "_".join(k for k, _ in keys)
    )
