from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from itertools import groupby

from .. import models, schemas, auth, database

router = APIRouter(
    prefix="/api/topics",
    tags=["Topics"],
)

@router.get("", response_model=dict)
def get_topics(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Return all topics grouped by subject, including the user's TopicScore
    topics = db.query(models.Topic).all()
    scores = db.query(models.TopicScore).filter(models.TopicScore.user_id == current_user.id).all()
    score_map = {s.topic_id: s.score for s in scores}

    result = {}
    
    # Sort by subject first for groupby
    sorted_topics = sorted(topics, key=lambda t: t.subject.value)
    for subject, group in groupby(sorted_topics, key=lambda t: t.subject.value):
        if current_user.exam_type == models.ExamType.JEE and subject == "Biology":
            continue
        if current_user.exam_type == models.ExamType.NEET and subject == "Math":
            continue
            
        topic_list = []
        for t in group:
            t_data = t.__dict__.copy()
            t_data.pop("_sa_instance_state", None)
            t_data["user_score"] = score_map.get(t.id, 50.0) # default neutralizing score
            topic_list.append(t_data)
        result[subject] = topic_list
        
    return result


@router.get("/{topic_id}", response_model=schemas.TopicWithScore)
def get_topic_detail(topic_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    score = db.query(models.TopicScore).filter(
        models.TopicScore.user_id == current_user.id,
        models.TopicScore.topic_id == topic_id
    ).first()
    
    topic_data = topic.__dict__.copy()
    topic_data["user_score"] = score.score if score else 50.0
    return topic_data

@router.get("/{topic_id}/questions", response_model=List[schemas.QuestionOut])
def get_topic_questions(topic_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Returns 20 questions for a topic. The response_model omits correct_option.
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    questions = db.query(models.Question).filter(models.Question.topic_id == topic_id).limit(20).all()
    return questions
