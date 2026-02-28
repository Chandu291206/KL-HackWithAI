import json
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from .. import models
from .llm_service import generate_json_sync
import asyncio

# Usually called in a background task
async def check_and_create_suggestion(user_id: int, db: Session):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: return
    
    # We need to find if any scores dropped significantly. But we only have current scores.
    # Alternatively, we just look for topics < 40
    current_scores = db.query(models.TopicScore).filter(
        models.TopicScore.user_id == user_id,
        models.TopicScore.score < 40.0
    ).all()
    
    if not current_scores:
        return # No critical topics
        
    # Get the worst one
    worst_topic_score = min(current_scores, key=lambda s: s.score)
    topic = db.query(models.Topic).filter(models.Topic.id == worst_topic_score.topic_id).first()
    
    # Check if a suggestion is already pending
    pending = db.query(models.ScheduleSuggestion).filter(
        models.ScheduleSuggestion.user_id == user_id,
        models.ScheduleSuggestion.status == models.SuggestionStatus.PENDING
    ).first()
    if pending:
        return # don't overwhelm User
        
    prompt = f"""You are an AI study coach for JEE/NEET.
The student "{user.name}" is struggling critically with the topic "{topic.name}" (Score: {worst_topic_score.score:.1f}/100).
They currently study {user.daily_hours} hours per day.

Generate a JSON object containing:
1. "message": A 2-sentence encouraging, personalized message suggesting they dedicate the next 3 days heavily to this topic.
2. "plan": A 3-day replacement study schedule plan JSON array.

Formatting Rules for "plan" array:
[
  {{
    "day": 1,
    "tasks": [
      {{"topic_id": {topic.id}, "topic_name": "{topic.name}", "type": "video", "duration_mins": 60, "description": "Watch full one-shot lecture"}}
    ]
  }}
]

Return strictly valid JSON only: {{"message": "...", "plan": [...]}}
"""

    json_str = await generate_json_sync(prompt)
    
    try:
        data = json.loads(json_str)
        msg = data.get("message", f"You should focus more on {topic.name}.")
        plan_arr = data.get("plan", [])
    except Exception as e:
        print(f"Failed to parse suggestion: {e}")
        return
        
    sugg = models.ScheduleSuggestion(
        user_id=user_id,
        trigger_reason=f"Score in {topic.name} fell to {worst_topic_score.score:.1f}",
        suggested_plan_json=json.dumps(plan_arr),
        status=models.SuggestionStatus.PENDING,
        llm_message=msg
    )
    db.add(sugg)
    
    # Send Notification
    from ..routers.notifications import push_notification
    push_notification(db, user_id, f"⚠️ You have a new schedule suggestion for {topic.name}!", models.NotificationType.SUGGESTION)
    
    db.commit()

# Note: The actual call from tests.py needs to run this async block if used as FastAPI BackgroundTask,
# which can handle async functions directly since FastAPI 0.60+
