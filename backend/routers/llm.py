import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .. import models, schemas, auth, database
from ..services.llm_service import stream_explanation

router = APIRouter(
    prefix="/api/llm",
    tags=["LLM AI Tutor"],
)

class ExplainRequest(BaseModel):
    question_id: int
    user_answer: str

async def explanation_generator(db: Session, req: ExplainRequest, current_user: models.User, prompt: str):
    full_response = ""
    async for chunk in stream_explanation(prompt):
        full_response += chunk
        yield chunk
        
    # After streaming completes, save to DB
    new_expl = models.QuestionExplanation(
        question_id=req.question_id,
        user_id=current_user.id,
        explanation_text=full_response
    )
    db.add(new_expl)
    db.commit()

@router.post("/explain")
async def explain_answer(req: ExplainRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Check cache first
    cached = db.query(models.QuestionExplanation).filter(
        models.QuestionExplanation.user_id == current_user.id,
        models.QuestionExplanation.question_id == req.question_id
    ).first()
    
    if cached:
        # Fake a streaming response for cached data so the frontend handles it the same
        async def cached_stream():
            yield cached.explanation_text
        return StreamingResponse(cached_stream(), media_type="text/event-stream")

    # Fetch context
    q = db.query(models.Question).filter(models.Question.id == req.question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    topic = db.query(models.Topic).filter(models.Topic.id == q.topic_id).first()
    
    related = db.query(models.Question).filter(
        models.Question.topic_id == q.topic_id,
        models.Question.id != q.id
    ).limit(2).all()
    
    related_text = ""
    for idx, rq in enumerate(related):
        related_text += f"{idx+1}. {rq.question_text} (Ans: {rq.correct_option})\n"
        
    prompt = f"""You are a patient tutor explaining to a JEE/NEET student.
The student answered {req.user_answer} but the correct answer is {q.correct_option}.

Question: {q.question_text}
Options:
A) {q.option_a}
B) {q.option_b}
C) {q.option_c}
D) {q.option_d}
Correct Answer: {q.correct_option}

Topic Theory Context:
{topic.theory_summary}

Related concept questions for reference:
{related_text}

Stored explanation: {q.explanation}

Now explain to the student:
1. Why their answer was wrong (be empathetic, not condescending)
2. The underlying concept they need to understand
3. Why the correct answer is right
4. A one-line memory trick to remember this concept
Keep it conversational, under 200 words.
"""

    return StreamingResponse(
        explanation_generator(db, req, current_user, prompt),
        media_type="text/event-stream"
    )

from typing import List

class ChatMessage(BaseModel):
    role: str
    content: str

class TopicChatReq(BaseModel):
    topic_id: int
    messages: List[ChatMessage]
    question_id: int | None = None

@router.post("/topic-chat")
async def topic_chat(req: TopicChatReq, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    topic = db.query(models.Topic).filter(models.Topic.id == req.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    prompt = f"System: You are an expert AI tutor helping a {current_user.exam_type.value} student understand the topic '{topic.name}'.\n"
    prompt += f"Here is the theory summary of the topic:\n{topic.theory_summary}\n\n"
    
    if req.question_id:
        q = db.query(models.Question).filter(models.Question.id == req.question_id).first()
        if q:
            prompt += f"The student is specifically asking about this question:\n"
            prompt += f"Question: {q.question_text}\n"
            prompt += f"Options: A) {q.option_a}, B) {q.option_b}, C) {q.option_c}, D) {q.option_d}\n"
            prompt += f"Correct Answer: {q.correct_option}\n\n"
            
    prompt += "Keep your answers concise, encouraging, and easy to understand. Answer the user's latest question based on the conversation history.\n\n"
    
    for msg in req.messages:
        role_label = "Student" if msg.role == "user" else "Tutor"
        prompt += f"{role_label}: {msg.content}\n"
    
    prompt += "Tutor: "
    
    async def chat_generator():
        async for chunk in stream_explanation(prompt):
            yield chunk
            
    return StreamingResponse(chat_generator(), media_type="text/event-stream")

@router.get("/test-analysis/{test_id}")
async def get_test_analysis(test_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    test = db.query(models.MockTest).filter(
        models.MockTest.id == test_id,
        models.MockTest.user_id == current_user.id
    ).first()
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
        
    correct = 0
    total = test.total_questions
    topics = {}
    
    for tq in test.test_questions:
        q = tq.question
        t_name = q.topic.name if q.topic else "Unknown"
        if t_name not in topics:
            topics[t_name] = {"total": 0, "correct": 0}
            
        topics[t_name]["total"] += 1
        if tq.is_correct:
            topics[t_name]["correct"] += 1
            correct += 1
            
    score_pct = (correct / total * 100) if total > 0 else 0
    
    weak_topics = [t for t, stats in topics.items() if stats["total"] > 0 and (stats["correct"] / stats["total"]) < 0.5]
    strong_topics = [t for t, stats in topics.items() if stats["total"] > 0 and (stats["correct"] / stats["total"]) >= 0.5]
    
    prompt = f"""You are an encouraging AI tutor for {current_user.exam_type.value} aspirants.
The student just completed a mock test.
Overall Score: {score_pct:.1f}% ({correct}/{total} correct).
Strong Topics (>=50% correct): {', '.join(strong_topics) if strong_topics else 'None yet'}.
Weak Topics (<50% correct): {', '.join(weak_topics) if weak_topics else 'None'}.

Provide a very short (2-3 sentences max) personalized analysis of their performance. 
Be encouraging. If there are weak topics, advise them to focus on those. Do not use markdown like bolding or lists, just a simple conversational paragraph.
"""

    async def analysis_generator():
        async for chunk in stream_explanation(prompt):
            yield chunk

    return StreamingResponse(analysis_generator(), media_type="text/event-stream")
