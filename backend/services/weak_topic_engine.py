from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, asc, desc
from typing import List, Dict, Any
import random

from .. import models, schemas

def update_topic_scores(db: Session, user_id: int, test_results: List[schemas.AnswerSubmission]):
    """
    Called after test submission.
    For each topic that appeared in the test, calculate accuracy.
    new_score = (0.6 * this_test_accuracy * 100) + (0.4 * existing_score)
    """
    topic_stats = {} # topic_id -> {"correct": 0, "total": 0}
    
    # Analyze the test questions to group by topic
    for answer in test_results:
        question = db.query(models.Question).filter(models.Question.id == answer.question_id).first()
        if not question:
            continue
            
        t_id = question.topic_id
        if t_id not in topic_stats:
            topic_stats[t_id] = {"correct": 0, "total": 0}
            
        topic_stats[t_id]["total"] += 1
        
        # Check correctness by comparing cleanly
        if answer.user_answer and answer.user_answer.strip().upper() == question.correct_option.strip().upper():
            topic_stats[t_id]["correct"] += 1
            
    # Update scores
    for t_id, stats in topic_stats.items():
        if stats["total"] == 0:
            continue
            
        this_test_accuracy = stats["correct"] / stats["total"]
        
        score_row = db.query(models.TopicScore).filter(
            models.TopicScore.user_id == user_id,
            models.TopicScore.topic_id == t_id
        ).first()
        
        if not score_row:
            # Create if it doesn't exist (though it should from signup)
            score_row = models.TopicScore(user_id=user_id, topic_id=t_id, score=50.0)
            db.add(score_row)
            db.commit()
            db.refresh(score_row)
            
        old_score = score_row.score
        new_score = (0.6 * this_test_accuracy * 100.0) + (0.4 * old_score)
        
        # Clamp between 0 and 100
        score_row.score = max(0.0, min(100.0, new_score))
        
    db.commit()


def classify_topics(db: Session, user_id: int) -> schemas.TopicHealth:
    """
    Weak: score < 50
    Improving: 50 <= score < 75
    Strong: score >= 75
    """
    scores = db.query(models.TopicScore).filter(models.TopicScore.user_id == user_id).all()
    
    weak, improving, strong = [], [], []
    for s in scores:
        out = schemas.TopicScoreOut.model_validate(s)
        if s.score < 50:
            weak.append(out)
        elif s.score < 75:
            improving.append(out)
        else:
            strong.append(out)
            
    return schemas.TopicHealth(weak=weak, improving=improving, strong=strong)


def get_weighted_question_pool(db: Session, user_id: int, total_count: int, subject_filter: schemas.Subject = None) -> List[models.Question]:
    """
    50% Weak (prefer Hard, then fill with Medium)
    30% Improving (mixed)
    20% Strong (Easy/Medium)
    """
    health = classify_topics(db, user_id)
    
    weak_ids = [t.topic_id for t in health.weak]
    improving_ids = [t.topic_id for t in health.improving]
    strong_ids = [t.topic_id for t in health.strong]
    
    # Exclude questions recently answered (in last 3 tests)
    recent_tests = db.query(models.MockTest).filter(models.MockTest.user_id == user_id).order_by(desc(models.MockTest.created_at)).limit(3).all()
    recent_test_ids = [t.id for t in recent_tests]
    
    recently_answered = db.query(models.TestQuestion.question_id).filter(
        models.TestQuestion.test_id.in_(recent_test_ids)
    ).all()
    exclude_q_ids = [r[0] for r in recently_answered]
    
    # Also prioritize previously wrong questions
    wrong_q_records = db.query(models.TestQuestion.question_id).join(models.MockTest).filter(
        models.MockTest.user_id == user_id,
        models.TestQuestion.is_correct == False
    ).all()
    wrong_q_ids = set([r[0] for r in wrong_q_records])

    pool = []
    
    def fetch_questions(t_ids, count, difficulty_prefs=None):
        if not t_ids or count <= 0: return []
        
        q = db.query(models.Question).filter(
            models.Question.topic_id.in_(t_ids),
            ~models.Question.id.in_(exclude_q_ids)
        )
        
        if subject_filter:
            q = q.join(models.Topic).filter(models.Topic.subject == subject_filter)
            
        all_qs = q.all()
        
        # Sort by previously wrong first, then by matching difficulty
        def sort_key(q_item):
            is_wrong = 0 if q_item.id in wrong_q_ids else 1
            diff_match = 0
            if difficulty_prefs and q_item.difficulty in difficulty_prefs:
               diff_match = -difficulty_prefs.index(q_item.difficulty) # lower is better
            return (is_wrong, diff_match, random.random())
            
        sorted_qs = sorted(all_qs, key=sort_key)
        return sorted_qs[:count]

    # Calculate counts
    weak_count = int(total_count * 0.5)
    improving_count = int(total_count * 0.3)
    strong_count = total_count - weak_count - improving_count # remaining
    
    pool.extend(fetch_questions(weak_ids, weak_count, [schemas.QuestionDifficulty.HARD, schemas.QuestionDifficulty.MEDIUM]))
    pool.extend(fetch_questions(improving_ids, improving_count, [schemas.QuestionDifficulty.EASY, schemas.QuestionDifficulty.MEDIUM, schemas.QuestionDifficulty.HARD]))
    pool.extend(fetch_questions(strong_ids, strong_count, [schemas.QuestionDifficulty.EASY, schemas.QuestionDifficulty.MEDIUM]))
    
    # If we don't have enough, pad from anywhere
    if len(pool) < total_count:
        needed = total_count - len(pool)
        existing_ids = [p.id for p in pool]
        fallback = db.query(models.Question).filter(~models.Question.id.in_(existing_ids))
        if subject_filter:
            fallback = fallback.join(models.Topic).filter(models.Topic.subject == subject_filter)
        pool.extend(fallback.limit(needed).all())
        
    random.shuffle(pool)
    return pool

def build_exam_question_pool(db: Session, user_id: int, exam_type: models.ExamType) -> List[models.Question]:
    """
    Builds an exam pool based on exam_type.
    JEE: 45 qs (15 per Phy/Chem/Math) -> 10H, 15E, 20M overall.
    NEET: 60 qs (30 Bio, 15 Phy, 15 Chem) -> ratio roughly 2:3:4 (H:E:M) => 13H, 20E, 27M.
    """
    pool = []

    def fetch_subject(subject: models.Subject, count: int, h_count: int, e_count: int, m_count: int):
        subject_pool = []
        
        # Helper to fetch and pad
        def get_qs(diff: models.QuestionDifficulty, limit: int, exclude_ids: set):
            if limit <= 0: return []
            qs = db.query(models.Question).join(models.Topic).filter(
                models.Topic.subject == subject,
                models.Question.difficulty == diff,
                ~models.Question.id.in_(exclude_ids)
            ).order_by(models.Question.id).limit(limit).all()
            return qs

        exclude = set()
        
        h_qs = get_qs(models.QuestionDifficulty.HARD, h_count, exclude)
        exclude.update(q.id for q in h_qs)
        subject_pool.extend(h_qs)
        
        e_qs = get_qs(models.QuestionDifficulty.EASY, e_count, exclude)
        exclude.update(q.id for q in e_qs)
        subject_pool.extend(e_qs)
        
        m_qs = get_qs(models.QuestionDifficulty.MEDIUM, m_count, exclude)
        exclude.update(q.id for q in m_qs)
        subject_pool.extend(m_qs)
        
        # Pad if short
        if len(subject_pool) < count:
            shortfall = count - len(subject_pool)
            pad_qs = db.query(models.Question).join(models.Topic).filter(
                models.Topic.subject == subject,
                ~models.Question.id.in_(exclude)
            ).order_by(models.Question.id).limit(shortfall).all()
            subject_pool.extend(pad_qs)
            
        return subject_pool
    
    if exam_type == models.ExamType.JEE:
        # 15 per subject. Target overall: 10H, 15E, 20M.
        pool.extend(fetch_subject(models.Subject.PHYSICS, 15, 3, 5, 7))
        pool.extend(fetch_subject(models.Subject.CHEMISTRY, 15, 3, 5, 7))
        pool.extend(fetch_subject(models.Subject.MATH, 15, 4, 5, 6))
        
    elif exam_type == models.ExamType.NEET:
        # 30 Bio, 15 Phy, 15 Chem. Target overall: 13H, 20E, 27M.
        pool.extend(fetch_subject(models.Subject.BIOLOGY, 30, 7, 10, 13))
        pool.extend(fetch_subject(models.Subject.PHYSICS, 15, 3, 5, 7))
        pool.extend(fetch_subject(models.Subject.CHEMISTRY, 15, 3, 5, 7))
        
    random.shuffle(pool)
    return pool
