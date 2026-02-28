from sqlalchemy.orm import Session
from datetime import datetime
from .. import models
from .weak_topic_engine import get_weighted_question_pool
from ..routers.notifications import push_notification

def build_weekly_test(db: Session, user_id: int):
    # Get 50 weighted questions
    pool = get_weighted_question_pool(db, user_id, 50)
    
    # Create MockTest
    test = models.MockTest(
        user_id=user_id,
        type=models.TestType.WEEKLY,
        total_questions=len(pool)
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    
    # Insert TestQuestion rows as placeholders
    for q in pool:
        tq = models.TestQuestion(test_id=test.id, question_id=q.id)
        db.add(tq)
        
    # Calculate week number (1-52)
    week_num = datetime.utcnow().isocalendar()[1]
    
    # Create WeeklyTest row
    wt = models.WeeklyTest(
        user_id=user_id,
        week_number=week_num,
        test_id=test.id
    )
    db.add(wt)
    
    # Notify user
    push_notification(db, user_id, "Your weekly test is ready 📋", models.NotificationType.WEEKLY)
    
    db.commit()
