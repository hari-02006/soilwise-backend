"""MongoDB access. If MONGODB_URI is not set, history features return 503 (never fake data)."""
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from pymongo import MongoClient
from app import config

_client = None
_collection = None


class DBUnavailable(RuntimeError):
    pass


def get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection
    if not config.MONGODB_URI:
        raise DBUnavailable("MongoDB is not configured. Set MONGODB_URI in backend/.env.")
    try:
        _client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=4000)
        _client.admin.command("ping")
    except Exception as e:
        _client = None
        raise DBUnavailable(f"Cannot reach MongoDB: {type(e).__name__}") from e
    _collection = _client[config.MONGODB_DB]["soil_analyses"]
    return _collection


def set_collection(c):  # used by tests
    global _collection
    _collection = c


def is_available() -> bool:
    try:
        get_collection(); return True
    except DBUnavailable:
        return False


def _out(doc):
    doc["analysis_id"] = str(doc.pop("_id"))
    return doc


def save(doc: dict) -> str:
    doc["created_at"] = datetime.now(timezone.utc)
    return str(get_collection().insert_one(doc).inserted_id)


def get(aid: str) -> Optional[dict]:
    try: oid = ObjectId(aid)
    except Exception: return None
    d = get_collection().find_one({"_id": oid})
    return _out(d) if d else None


def list_all(limit=50):
    return [_out(d) for d in get_collection().find().sort("created_at", -1).limit(limit)]


def delete(aid: str) -> bool:
    try: oid = ObjectId(aid)
    except Exception: return False
    return get_collection().delete_one({"_id": oid}).deleted_count == 1


def statistics():
    c = get_collection()
    total = c.count_documents({})
    pipeline = [{"$match": {"crop_recommendations": {"$ne": None}}},
                {"$project": {"top": {"$arrayElemAt": ["$crop_recommendations.top_crops", 0]}}},
                {"$group": {"_id": "$top.crop", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 5}]
    top = [{"crop": r["_id"], "count": r["count"]} for r in c.aggregate(pipeline)]
    ph_counts = {}
    for d in c.find({}, {"soil_health.parameters.ph": 1}):
        cls = d.get("soil_health", {}).get("parameters", {}).get("ph", {}).get("class")
        if cls: ph_counts[cls] = ph_counts.get(cls, 0) + 1
    return {"total_analyses": total, "top_recommended_crops": top, "ph_class_distribution": ph_counts}
