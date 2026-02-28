from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas, auth, database

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)

def push_notification(db: Session, user_id: int, message: str, type: models.NotificationType):
    n = models.Notification(user_id=user_id, message=message, type=type)
    db.add(n)
    db.commit()

@router.get("", response_model=List[dict])
def get_notifications(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).all()
    
    res = []
    for n in notifs:
        d = n.__dict__.copy()
        d.pop("_sa_instance_state", None)
        res.append(d)
    return res

@router.post("/{notification_id}/read")
def read_notification(notification_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    n = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if not n:
        raise HTTPException(status_code=404, detail="Not found")
        
    n.is_read = True
    db.commit()
    return {"status": "ok"}
