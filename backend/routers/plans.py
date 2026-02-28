import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from .. import models, schemas, auth, database
from ..services.weak_topic_engine import classify_topics
from ..services.llm_service import generate_json_sync, check_ollama_health
# from ..services.notification_service import push_notification

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/plans",
    tags=["Study Plans"],
)

@router.get("/health")
async def check_health():
    is_healthy = await check_ollama_health()
    if is_healthy:
        return {"status": "ok", "llm": "online"}
    return {"status": "error", "llm": "offline"}

@router.post("/generate", response_model=schemas.StudyPlanOut)
async def generate_plan(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # 1. Sync missing TopicScore rows dynamically
    all_topics = db.query(models.Topic.id).all()
    all_topic_ids = {t[0] for t in all_topics}
    
    existing_scores = db.query(models.TopicScore.topic_id).filter(models.TopicScore.user_id == current_user.id).all()
    existing_topic_ids = {s[0] for s in existing_scores}
    
    missing_topic_ids = all_topic_ids - existing_topic_ids
    if missing_topic_ids:
        for t_id in missing_topic_ids:
            new_score = models.TopicScore(user_id=current_user.id, topic_id=t_id, score=50.0)
            db.add(new_score)
        db.commit()
        
    health = classify_topics(db, current_user.id)
    
    def get_topics_with_ids(score_outs):
        topic_ids = [t.topic_id for t in score_outs]
        if not topic_ids: return []
        topics = db.query(models.Topic).filter(models.Topic.id.in_(topic_ids)).all()
        return [{"id": t.id, "name": t.name} for t in topics]

    weak_topics = get_topics_with_ids(health.weak)
    improving_topics = get_topics_with_ids(health.improving)
    strong_topics = get_topics_with_ids(health.strong)
    
    weak_names = [t["name"] for t in weak_topics]
    improving_names = [t["name"] for t in improving_topics]
    strong_names = [t["name"] for t in strong_topics]
    
    days_left = 7
    if current_user.exam_date:
        delta = (current_user.exam_date.date() - datetime.utcnow().date()).days
        if 0 < delta < 7:
            days_left = delta
            
    prompt = f"""You are an expert JEE/NEET study planner.
Create a {days_left}-day study schedule for a student who studies {current_user.daily_hours} hours per day.

Their topic health is:
Weak (Need urgent focus): {', '.join(weak_names) if weak_names else 'None'}
Improving: {', '.join(improving_names) if improving_names else 'None'}
Strong: {', '.join(strong_names) if strong_names else 'None'}

Return ONLY a JSON object with a single key "plan", containing an array with exactly {days_left} elements representing days.
Structure:
{{
  "plan": [
    {{
      "day": 1,
      "tasks": [
        {{
          "topic_id": 1,
          "topic_name": "Kinematics",
          "type": "theory", 
          "duration_mins": 60,
          "description": "Read summary and watch 1 shot video",
          "completed": false
        }}
      ]
    }}
  ]
}}

Rules:
- Give type as either "theory", "questions", or "video".
- Make sure total daily duration_mins is approx {current_user.daily_hours * 60}.
- Only output valid JSON. No Markdown format. Do not wrap in ```.
"""
    
    json_str = await generate_json_sync(prompt, json_format=True)
    
    # 2. Try parsing & strip markdown
    try:
        json_str = json_str.strip()
        if json_str.startswith("```"):
            lines = json_str.split("\n")
            if lines[0].startswith("```"): lines = lines[1:]
            if lines[-1].startswith("```"): lines = lines[:-1]
            json_str = "\n".join(lines).strip()
            
        plan_data = json.loads(json_str)
        
        # If wrapped in "plan" key, extract it
        if isinstance(plan_data, dict) and "plan" in plan_data:
            plan_data = plan_data["plan"]
        elif isinstance(plan_data, dict):
            # Fallback check first list
            for val in plan_data.values():
                if isinstance(val, list):
                    plan_data = val
                    break
                    
        # minimal validation
        if not isinstance(plan_data, list) or len(plan_data) == 0:
             raise ValueError("Expected non-empty list")
    except Exception as e:
        logger.error(f"[LLM] Failed to parse LLM plan: {e}\nRaw={json_str}")
        
        # 3. Meaningful Fallback Plan
        all_topic_pool = weak_topics + improving_topics + strong_topics
        if not all_topic_pool:
            all_topic_pool = [{"id": 0, "name": "General Revision"}]
            
        daily_mins = int(current_user.daily_hours * 60)
        task_duration = min(60, daily_mins) # default 60 mins per task
        tasks_per_day = max(1, daily_mins // task_duration)
        
        plan_data = []
        topic_idx = 0
        for i in range(1, days_left+1):
            day_tasks = []
            for _ in range(tasks_per_day):
                t_obj = all_topic_pool[topic_idx % len(all_topic_pool)]
                topic_idx += 1
                day_tasks.append({
                    "topic_id": t_obj.get("id"),
                    "topic_name": t_obj.get("name"),
                    "type": "questions" if i % 2 == 0 else "theory",
                    "duration_mins": task_duration,
                    "description": "Fallback revision task based on your topic list.",
                    "completed": False
                })
            plan_data.append({"day": i, "tasks": day_tasks})
        
    # Mark old plans inactive
    db.query(models.StudyPlan).filter(
        models.StudyPlan.user_id == current_user.id,
        models.StudyPlan.is_active == True
    ).update({"is_active": False})
    
    new_plan = models.StudyPlan(
        user_id=current_user.id,
        week_start=datetime.utcnow(),
        plan_json=json.dumps(plan_data),
        is_active=True
    )
    db.add(new_plan)
    
    # Notification
    from .notifications import push_notification
    push_notification(db, current_user.id, "Your new study plan is ready 📅", models.NotificationType.SUGGESTION)
    
    db.commit()
    db.refresh(new_plan)
    
    # Needs to match the Pydantic schema properly by loading the string
    return schemas.StudyPlanOut(
        id=new_plan.id,
        week_start=new_plan.week_start,
        plan_json=json.loads(new_plan.plan_json),
        is_active=new_plan.is_active
    )


@router.get("/current", response_model=Optional[schemas.StudyPlanOut])
def get_current_plan(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    plan = db.query(models.StudyPlan).filter(
        models.StudyPlan.user_id == current_user.id,
        models.StudyPlan.is_active == True
    ).first()
    
    if not plan:
        return None
        
    return schemas.StudyPlanOut(
        id=plan.id,
        week_start=plan.week_start,
        plan_json=json.loads(plan.plan_json),
        is_active=plan.is_active
    )

class TaskCompleteReq(BaseModel):
    day: int
    task_index: int

@router.post("/task/complete")
def complete_task(req: TaskCompleteReq, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    plan = db.query(models.StudyPlan).filter(
        models.StudyPlan.user_id == current_user.id,
        models.StudyPlan.is_active == True
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="No active plan found")
        
    plan_data = json.loads(plan.plan_json)
    try:
        for day_struct in plan_data:
            if day_struct["day"] == req.day:
                # Mark as completed (adding a 'completed' flag)
                if 0 <= req.task_index < len(day_struct["tasks"]):
                    day_struct["tasks"][req.task_index]["completed"] = True
                    break
    except Exception:
        pass
        
    plan.plan_json = json.dumps(plan_data)
    
    # Completing a task triggers streak update conceptually, though typically tests do it
    from .tests import update_streak
    update_streak(db, current_user.id)
    
    db.commit()
    return {"status": "ok"}
