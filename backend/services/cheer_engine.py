import random
from sqlalchemy.orm import Session
from .. import models
from ..routers.notifications import push_notification

CHEER_MESSAGES = [
    "You're doing great! Keep up the hard work.",
    "Consistency is key. Another day, another step closer to your goal!",
    "Remember why you started. You've got this.",
    "Small progress is still progress. Keep going!",
    "Believe in yourself as much as we believe in you.",
]

def generate_daily_cheer(user_id: int, db: Session):
    msg = random.choice(CHEER_MESSAGES)
    push_notification(db, user_id, msg, models.NotificationType.CHEER)
