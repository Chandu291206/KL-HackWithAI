from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from .. import models, schemas, auth, database
from ..services.weak_topic_engine import update_topic_scores, get_weighted_question_pool, build_exam_question_pool
from ..services.suggestion_service import check_and_create_suggestion

router = APIRouter(
    prefix="/api/tests",
    tags=["Tests"],
)

def update_streak(db: Session, user_id: int):
    streak = db.query(models.Streak).filter(models.Streak.user_id == user_id).first()
    if not streak:
        return
        
    now = datetime.utcnow()
    last = streak.last_active_date
    
    # Calculate days difference safely
    days_diff = (now.date() - last.date()).days
    
    if days_diff == 1:
        streak.current_streak += 1
    elif days_diff > 1:
        streak.current_streak = 1
    # else days_diff == 0: no change to current streak
    
    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak
        
    streak.last_active_date = now
    db.commit()


@router.post("/submit", response_model=schemas.TestResultOut)
def submit_test(
    submission: schemas.TestSubmitData, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    test = db.query(models.MockTest).filter(
        models.MockTest.id == submission.test_id, 
        models.MockTest.user_id == current_user.id
    ).first()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
        
    if test.is_completed:
        raise HTTPException(status_code=400, detail="Test already completed")
        
    correct_count = 0
    total_time = 0
    wrong_q_ids = []
    
    for ans in submission.answers:
        q = db.query(models.Question).filter(models.Question.id == ans.question_id).first()
        if not q:
            continue
            
        tq = db.query(models.TestQuestion).filter(
            models.TestQuestion.test_id == test.id,
            models.TestQuestion.question_id == q.id
        ).first()
        
        if not tq:
            tq = models.TestQuestion(test_id=test.id, question_id=q.id)
            db.add(tq)
            
        tq.time_spent_seconds = ans.time_spent_seconds
        total_time += ans.time_spent_seconds
        
        # Grading
        if ans.user_answer and q.correct_option and ans.user_answer.strip().upper() == q.correct_option.strip().upper():
            tq.is_correct = True
            correct_count += 1
        else:
            tq.is_correct = False
            tq.user_answer = ans.user_answer
            wrong_q_ids.append(q.id)
            
    test.is_completed = True
    test.time_taken_seconds = total_time
    test.score = (correct_count / test.total_questions * 100) if test.total_questions > 0 else 0
    
    db.commit()
    
    # Update Scores and Streak
    update_topic_scores(db, current_user.id, submission.answers)
    update_streak(db, current_user.id)
    
    # Background suggestion check:
    background_tasks.add_task(check_and_create_suggestion, current_user.id, db)
    
    plan_regeneration_suggested = test.score < 50.0 
    
    return schemas.TestResultOut(
        score=test.score,
        time_taken_seconds=total_time,
        wrong_question_ids=wrong_q_ids,
        total_questions=test.total_questions,
        correct_answers=correct_count,
        plan_regeneration_suggested=plan_regeneration_suggested,
        questions=None
    )

@router.get("/history", response_model=List[schemas.TestHistoryOut])
def get_test_history(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    tests = db.query(models.MockTest).filter(
        models.MockTest.user_id == current_user.id,
        models.MockTest.is_completed == True
    ).order_by(models.MockTest.created_at.asc()).all()
    return tests


class GenerateTopicTestReq(BaseModel):
    topic_id: int
    count: int
    difficulty: str # easy, mixed, hard
    
@router.post("/generate/topic")
def generate_topic_test(req: GenerateTopicTestReq, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    q_query = db.query(models.Question).filter(models.Question.topic_id == req.topic_id)
    if req.difficulty != "mixed":
        diff_enum = models.QuestionDifficulty(req.difficulty)
        q_query = q_query.filter(models.Question.difficulty == diff_enum)
        
    questions = q_query.limit(req.count).all()
    
    test = models.MockTest(
        user_id=current_user.id,
        type=models.TestType.TOPIC,
        total_questions=len(questions)
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    
    return {
        "test_id": test.id,
        "questions": [schemas.QuestionOut.model_validate(q) for q in questions]
    }

class GenerateQuickTestReq(BaseModel):
    count: int = 50
    subject_filter: Optional[models.Subject] = None

@router.post("/generate/quick")
def generate_quick_test(req: GenerateQuickTestReq, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    pool = get_weighted_question_pool(db, current_user.id, req.count, req.subject_filter)
    
    test = models.MockTest(
        user_id=current_user.id,
        type=models.TestType.QUICK,
        total_questions=len(pool)
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    
    return {
        "test_id": test.id,
        "questions": [schemas.QuestionOut.model_validate(q) for q in pool]
    }

class GenerateCustomTestReq(BaseModel):
    topic_ids: List[int]
    count: int
    difficulty: str # easy, mixed, hard

@router.post("/generate/custom")
def generate_custom_test(req: GenerateCustomTestReq, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    q_query = db.query(models.Question).filter(models.Question.topic_id.in_(req.topic_ids))
    if req.difficulty != "mixed":
        diff_enum = models.QuestionDifficulty(req.difficulty)
        q_query = q_query.filter(models.Question.difficulty == diff_enum)
        
    questions = q_query.limit(req.count).all()
    
    test = models.MockTest(
        user_id=current_user.id,
        type=models.TestType.CUSTOM,
        total_questions=len(questions)
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    
    return {
        "test_id": test.id,
        "questions": [schemas.QuestionOut.model_validate(q) for q in questions]
    }

@router.post("/generate/exam")
def generate_exam(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not current_user.exam_type:
        raise HTTPException(status_code=400, detail="User exam type not set")

    pool = build_exam_question_pool(db, current_user.id, current_user.exam_type)
    
    test = models.MockTest(
        user_id=current_user.id,
        type=models.TestType.PROCTOR,
        total_questions=len(pool)
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    
    return {
        "test_id": test.id,
        "test_name": f"Full {current_user.exam_type.value} Mock Exam",
        "questions": [schemas.QuestionOut.model_validate(q) for q in pool]
    }

@router.get("/latest", response_model=schemas.TestResultOut)
def get_latest_test(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Get the latest completed test for the user
    recent_test = db.query(models.MockTest).filter(
        models.MockTest.user_id == current_user.id,
        models.MockTest.is_completed == True
    ).order_by(models.MockTest.created_at.desc()).first()
    
    if not recent_test:
        raise HTTPException(status_code=404, detail="No completed tests found")
        
    wrong_q_ids = []
    questions_data = []
    correct_count = 0
    
    for tq in recent_test.test_questions:
        q = tq.question
        if not tq.is_correct:
            wrong_q_ids.append(q.id)
        else:
            correct_count += 1
            
        questions_data.append({
            "id": q.id,
            "topic_id": q.topic_id,
            "topic_name": q.topic.name if q.topic else "Unknown Topic",
            "question_text": q.question_text,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "correct_answer": q.correct_option,
            "user_answer": tq.user_answer,
            "explanation": q.explanation,
            "time_spent_seconds": tq.time_spent_seconds
        })
        
    return {
        "score": recent_test.score,
        "time_taken_seconds": recent_test.time_taken_seconds,
        "wrong_question_ids": wrong_q_ids,
        "total_questions": recent_test.total_questions,
        "correct_answers": correct_count,
        "plan_regeneration_suggested": False,
        "questions": questions_data
    }

@router.get("/{test_id}/suggestion", response_model=schemas.SuggestionOut)
def get_test_suggestion(test_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    suggestion = db.query(models.ScheduleSuggestion).filter(
        models.ScheduleSuggestion.user_id == current_user.id,
        models.ScheduleSuggestion.status == models.SuggestionStatus.PENDING
    ).order_by(models.ScheduleSuggestion.created_at.desc()).first()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="No suggestion found")
        
    return suggestion

