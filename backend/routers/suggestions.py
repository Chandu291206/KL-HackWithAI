import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas, auth, database

router = APIRouter(
    prefix="/api/suggestions",
    tags=["Suggestions"],
)

@router.get("/pending", response_model=List[schemas.SuggestionOut])
def get_pending(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    s = db.query(models.ScheduleSuggestion).filter(
        models.ScheduleSuggestion.user_id == current_user.id,
        models.ScheduleSuggestion.status == models.SuggestionStatus.PENDING
    ).all()
    
    return [schemas.SuggestionOut.model_validate(x) for x in s]


@router.post("/{suggestion_id}/accept")
def accept_suggestion(suggestion_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    sugg = db.query(models.ScheduleSuggestion).filter(
        models.ScheduleSuggestion.id == suggestion_id,
        models.ScheduleSuggestion.user_id == current_user.id
    ).first()
    
    if not sugg or sugg.status != models.SuggestionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invalid suggestion")
        
    sugg.status = models.SuggestionStatus.ACCEPTED
    
    # Mark old plans inactive
    db.query(models.StudyPlan).filter(
        models.StudyPlan.user_id == current_user.id,
        models.StudyPlan.is_active == True
    ).update({"is_active": False})
    
    # Apply new plan
    new_plan = models.StudyPlan(
        user_id=current_user.id,
        week_start=datetime.utcnow(),
        plan_json=sugg.suggested_plan_json,
        is_active=True
    )
    db.add(new_plan)
    db.commit()
    
    return {"status": "ok"}


@router.post("/{suggestion_id}/reject")
def reject_suggestion(suggestion_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    sugg = db.query(models.ScheduleSuggestion).filter(
        models.ScheduleSuggestion.id == suggestion_id,
        models.ScheduleSuggestion.user_id == current_user.id
    ).first()
    
    if not sugg or sugg.status != models.SuggestionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invalid suggestion")
        
    sugg.status = models.SuggestionStatus.REJECTED
    db.commit()
    
    return {"status": "ok"}
