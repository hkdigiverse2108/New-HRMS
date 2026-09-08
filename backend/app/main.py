from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.redis.client import redis_client
from app.database.db import connect_to_mongo, close_mongo_connection, db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup events
    await connect_to_mongo()
    yield
    # Shutdown events
    await close_mongo_connection()

app = FastAPI(title="New-HRMS", lifespan=lifespan)

@app.get("/")
async def root():
    return {"message": "Welcome to New-HRMS API"}

@app.get("/test-redis")
async def test_redis():
    try:
        await redis_client.set("test_key", "Redis is successfully connected!")
        value = await redis_client.get("test_key")
        return {"status": "success", "message": value}
    except Exception as e:
        return {"status": "error", "message": f"Failed to connect to Redis: {str(e)}"}

@app.get("/test-mongo")
async def test_mongo():
    try:
        # Ping the database to check connection
        await db.client.admin.command('ping')
        return {"status": "success", "message": "MongoDB is successfully connected!"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to connect to MongoDB: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    from app.config import settings
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
