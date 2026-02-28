import os
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from . import database, models
from .services.cheer_engine import generate_daily_cheer
from .services.test_builder import build_weekly_test

# Rename routers to avoid conflicts with modules if any
from .routers.auth import router as auth_rt
from .routers.topics import router as topic_rt
from .routers.user import router as user_rt
from .routers.tests import router as test_rt
from .routers.plans import router as plan_rt
from .routers.suggestions import router as sugg_rt
from .routers.notifications import router as notif_rt
from .routers.llm import router as llm_rt
from .routers.youtube import router as yt_rt


# Create Tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="EduCoach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_rt)
app.include_router(topic_rt)
app.include_router(user_rt)
app.include_router(test_rt)
app.include_router(plan_rt)
app.include_router(sugg_rt)
app.include_router(notif_rt)
app.include_router(llm_rt)
app.include_router(yt_rt)


scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup_event():
    # Initialize APScheduler jobs
    scheduler.add_job(daily_job, "cron", hour=8, minute=0)
    scheduler.add_job(weekly_job, "cron", day_of_week="mon", hour=6, minute=0)
    
    scheduler.start()
    print("APScheduler started")

def daily_job():
    print("Running Daily Cron Job...")
    db = database.SessionLocal()
    users = db.query(models.User).all()
    now = datetime.utcnow()
    for u in users:
        # Check streak
        streak = db.query(models.Streak).filter(models.Streak.user_id == u.id).first()
        if streak:
            days_diff = (now.date() - streak.last_active_date.date()).days
            if days_diff == 1:
                from .routers.notifications import push_notification
                push_notification(db, u.id, "Don't break your streak! Log in today.", models.NotificationType.STREAK)
                
        # Generate daily cheer
        generate_daily_cheer(u.id, db)
    db.close()


def weekly_job():
    print("Running Weekly Cron Job...")
    db = database.SessionLocal()
    users = db.query(models.User).all()
    for u in users:
        build_weekly_test(db, u.id)
    db.close()

@app.get("/")
def read_root():
    return {"message": "EduCoach Backend is running"}
