from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.redis.service import redis_client
from app.database.db import connect_to_mongo, close_mongo_connection, db
from app.controllers.employee import router as employee_router
from app.controllers.auth import router as auth_router
from app.controllers.department import router as department_router
from app.controllers.sub_department import router as sub_department_router
from app.controllers.designation import router as designation_router
from app.controllers.access_control import router as access_control_router
from app.controllers.image import router as image_router, upload_router
from app.controllers.attendance import router as attendance_router
from app.controllers.leave import router as leave_router
from app.controllers.penalty import router as penalty_router
from app.controllers.task import router as task_router
from app.controllers.client import router as client_router
from app.controllers.project import router as project_router
from app.controllers.content import router as content_router
from app.controllers.activity import router as activity_router
from app.controllers.research import router as research_router
from app.controllers.remark import router as remark_router
from app.controllers.notification import router as notification_router
from app.controllers.daily_progress import router as daily_progress_router
from app.controllers.chat import router as chat_router
from app.controllers.dashboard import router as dashboard_router
from app.controllers.schedule import router as schedule_router
from app.controllers.booking import booking_router, public_booking_router
from app.controllers.preset import router as preset_router
from app.controllers.invoice import router as invoice_router
from app.controllers.bank_account import router as bank_account_router
from app.controllers.quotation import router as quotation_router
from app.models.employee import setup_employee_indexes
from app.models.department import setup_department_indexes
from app.models.sub_department import setup_sub_department_indexes
from app.models.designation import setup_designation_indexes
from app.models.penalty import setup_penalty_indexes
from app.database.default_presets import init_database_presets_and_admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup events
    await connect_to_mongo()
    try:
        await setup_employee_indexes(db.db)
        await setup_department_indexes(db.db)
        await setup_sub_department_indexes(db.db)
        await setup_designation_indexes(db.db)
        await setup_penalty_indexes(db.db)
        await init_database_presets_and_admin(db.db)
        # Hot-path indexes for dashboard ONE-API (idempotent)
        try:
            await db.db["tasks"].create_index([("is_deleted", 1), ("status", 1)])
            await db.db["tasks"].create_index([("is_deleted", 1), ("due_date", 1)])
            await db.db["tasks"].create_index([("assigned_to", 1), ("is_deleted", 1)])
            await db.db["projects"].create_index([("is_deleted", 1)])
            await db.db["projects"].create_index([("general.status", 1)])
            await db.db["notifications"].create_index([("recipient_id", 1), ("is_read", 1), ("created_at", -1)])
            await db.db["remarks"].create_index([("submitted_by_id", 1)])
        except Exception as ie:
            print(f"[STARTUP WARNING] dashboard index notice: {ie}")
    except Exception as e:
        print(f"[STARTUP WARNING] Database startup initialization notice: {e}")
    yield
    # Shutdown events
    await close_mongo_connection()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="New-HRMS", lifespan=lifespan, redirect_slashes=False)

# Enable CORS for all origins (including file://, null, and localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.types import ASGIApp, Scope, Receive, Send

class ImageRouteMiddleware:
    """Redirects API endpoints from /images/* prefix so StaticFiles mount doesn't intercept them with 405."""
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path in ("/images/upload", "/images/upload/"):
                scope["path"] = "/upload"
            elif path in ("/images/list", "/images/list/"):
                scope["path"] = "/api/images/list"
        await self.app(scope, receive, send)

app.add_middleware(ImageRouteMiddleware)

from fastapi.staticfiles import StaticFiles
from app.config import ROOT_DIR

# Root images folder (outside frontend and backend)
IMAGES_DIR = ROOT_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Register API routes FIRST so FastAPI matches endpoint routes before static file mounts
app.include_router(auth_router)
app.include_router(employee_router)
app.include_router(department_router)
app.include_router(sub_department_router)
app.include_router(designation_router)
app.include_router(access_control_router)
app.include_router(image_router)
app.include_router(upload_router)
app.include_router(attendance_router)
app.include_router(leave_router)
app.include_router(penalty_router)
app.include_router(task_router)
app.include_router(client_router)
app.include_router(project_router)
app.include_router(content_router)
app.include_router(activity_router)
app.include_router(research_router)
app.include_router(remark_router)
app.include_router(notification_router)
app.include_router(daily_progress_router)
app.include_router(chat_router)
app.include_router(dashboard_router)
app.include_router(schedule_router)
app.include_router(booking_router)
app.include_router(public_booking_router)
app.include_router(preset_router)
app.include_router(invoice_router)
app.include_router(bank_account_router)
app.include_router(quotation_router)

# Mount static image paths AFTER API routes
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/uploads", StaticFiles(directory=str(IMAGES_DIR)), name="uploads")

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
