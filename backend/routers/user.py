from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from .. import models, schemas, auth, database

router = APIRouter(
    prefix="/api/user",
    tags=["User"],
)

@router.get("/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.get("/streak", response_model=schemas.StreakData)
def read_user_streak(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    streak = db.query(models.Streak).filter(models.Streak.user_id == current_user.id).first()
    if not streak:
        # Should exist since created on signup, but handle just in case
        return schemas.StreakData(current=0, longest=0, last_active=datetime.utcnow())
    return schemas.StreakData(
        current=streak.current_streak,
        longest=streak.longest_streak,
        last_active=streak.last_active_date
    )
    
import asyncio
from ..services.weak_topic_engine import classify_topics

@router.get("/dashboard", response_model=schemas.DashboardOut)
def get_dashboard(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    user_data = current_user.__dict__.copy()
    user_data.pop("_sa_instance_state", None)
    
    # Streak
    streak = db.query(models.Streak).filter(models.Streak.user_id == current_user.id).first()
    streak_data = schemas.StreakData(current=streak.current_streak if streak else 0, longest=streak.longest_streak if streak else 0, last_active=streak.last_active_date if streak else datetime.utcnow())
    
    # Active Plan tasks for today
    plan = db.query(models.StudyPlan).filter(models.StudyPlan.user_id == current_user.id, models.StudyPlan.is_active == True).first()
    today_plan = None
    if plan:
        import json
        p_json = json.loads(plan.plan_json)
        # Find the first day with at least one incomplete task
        for d in p_json:
            tasks = d.get("tasks", [])
            # A day is incomplete if it has NO tasks or any task is NOT completed
            if not tasks or any(not t.get("completed", False) for t in tasks):
                today_plan = d
                break
        
        # If all days are fully completed, show the last day
        if not today_plan and len(p_json) > 0:
            today_plan = p_json[-1]
                
    # Topic Health
    health = classify_topics(db, current_user.id)
    topic_health = {"Physics": [], "Chemistry": []}
    if current_user.exam_type != models.ExamType.NEET:
        topic_health["Math"] = []
    if current_user.exam_type != models.ExamType.JEE:
        topic_health["Biology"] = []
    
    def add_to_health(topic_obj, type_str):
        t_data = topic_obj.model_dump()
        t = db.query(models.Topic).filter(models.Topic.id == topic_obj.topic_id).first()
        if t.subject.value not in topic_health:
            return
        t_data["name"] = t.name
        t_data["type"] = type_str
        topic_health[t.subject.value].append(t_data)
        
    for x in health.weak: add_to_health(x, "weak")
    for x in health.improving: add_to_health(x, "improving")
    for x in health.strong: add_to_health(x, "strong")
    
    # Radar Data (Averages)
    radar_data = {}
    for subj, records in topic_health.items():
        if records:
            radar_data[subj] = sum(r["score"] for r in records) / len(records)
        else:
            radar_data[subj] = 50.0
            
    # Pending Suggestions
    suggestions = db.query(models.ScheduleSuggestion).filter(
        models.ScheduleSuggestion.user_id == current_user.id,
        models.ScheduleSuggestion.status == models.SuggestionStatus.PENDING
    ).all()
    
    # Weekly Test Available
    weekly_test = db.query(models.WeeklyTest).filter(
        models.WeeklyTest.user_id == current_user.id,
        models.WeeklyTest.week_number == datetime.utcnow().isocalendar()[1],
        models.WeeklyTest.is_attempted == False
    ).first()
    weekly_available = weekly_test is not None
    
    # Recent Test Summary
    recent_test = db.query(models.MockTest).filter(
        models.MockTest.user_id == current_user.id,
        models.MockTest.is_completed == True
    ).order_by(models.MockTest.created_at.desc()).first()
    
    recent_summary = None
    if recent_test:
        recent_summary = {"id": recent_test.id, "score": recent_test.score, "type": recent_test.type.value}
        
    # Cheer message
    cheer = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.type == models.NotificationType.CHEER,
        models.Notification.is_read == False
    ).order_by(models.Notification.created_at.desc()).first()
    
    cheer_msg = cheer.message if cheer else None
    
    return schemas.DashboardOut(
        user=user_data,
        streak=streak_data,
        today_plan=today_plan,
        topic_health=topic_health,
        radar_data=radar_data,
        pending_suggestions=[schemas.SuggestionOut.model_validate(s) for s in suggestions],
        weekly_test_available=weekly_available,
        recent_test_summary=recent_summary,
        cheer_message=cheer_msg
    )
