from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.redis.client import redis_client
from app.database.db import connect_to_mongo, close_mongo_connection, db
from app.controllers.employee import router as employee_router
from app.controllers.auth import router as auth_router
from app.controllers.department import router as department_router
from app.controllers.sub_department import router as sub_department_router
from app.controllers.designation import router as designation_router
from app.models.employee import setup_employee_indexes
from app.models.department import setup_department_indexes
from app.models.sub_department import setup_sub_department_indexes
from app.models.designation import setup_designation_indexes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup events
    await connect_to_mongo()
    await setup_employee_indexes(db.db)
    await setup_department_indexes(db.db)
    await setup_sub_department_indexes(db.db)
    await setup_designation_indexes(db.db)
    yield
    # Shutdown events
    await close_mongo_connection()

app = FastAPI(title="New-HRMS", lifespan=lifespan)

# Register routes
app.include_router(auth_router)
app.include_router(employee_router)
app.include_router(department_router)
app.include_router(sub_department_router)
app.include_router(designation_router)

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
