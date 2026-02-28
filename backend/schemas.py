from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

from .models import ExamType, Subject, QuestionDifficulty, TestType, SuggestionStatus, NotificationType


# --- User Schemas ---
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    exam_type: ExamType
    daily_hours: float = 2.0
    exam_date: Optional[datetime] = None

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    exam_type: ExamType
    daily_hours: float
    exam_date: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[int] = None

# --- Topic Schemas ---
class TopicBase(BaseModel):
    id: int
    subject: Subject
    name: str
    theory_summary: str
    difficulty_avg: float

    model_config = ConfigDict(from_attributes=True)

class TopicScoreOut(BaseModel):
    id: int
    topic_id: int
    score: float
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)

class TopicWithScore(TopicBase):
    user_score: Optional[float] = None


# --- Question Schemas ---
class QuestionOut(BaseModel):
    id: int
    topic_id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    difficulty: QuestionDifficulty
    # NOTE: correct_option omitted intentionally here to prevent cheating before submission

    model_config = ConfigDict(from_attributes=True)


# --- Test Submission Schemas ---
class AnswerSubmission(BaseModel):
    question_id: int
    user_answer: Optional[str] = None
    time_spent_seconds: int

class TestSubmitData(BaseModel):
    test_id: int
    answers: List[AnswerSubmission]

class QuestionResultOut(BaseModel):
    id: int
    topic_id: int
    topic_name: Optional[str] = None
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    user_answer: Optional[str] = None
    explanation: Optional[str] = None
    time_spent_seconds: Optional[int] = 0

class TestResultOut(BaseModel):
    score: float
    time_taken_seconds: int
    wrong_question_ids: List[int]
    total_questions: int
    correct_answers: int
    plan_regeneration_suggested: bool
    questions: Optional[List[QuestionResultOut]] = None

class TestHistoryOut(BaseModel):
    id: int
    type: TestType
    score: Optional[float]
    total_questions: int
    time_taken_seconds: Optional[int]
    created_at: datetime
    is_completed: bool

    model_config = ConfigDict(from_attributes=True)

# --- AI Tutor / Explanation Schemas ---
class ExplainRequest(BaseModel):
    question_id: int
    user_answer: str

# --- Study Plan Schemas ---
class TaskData(BaseModel):
    topic_id: Optional[int] = None
    topic_name: str
    type: str # "theory", "questions", "video"
    duration_mins: int
    description: Optional[str] = ""
    completed: bool = False

class DayPlan(BaseModel):
    day: int
    tasks: List[TaskData]

class StudyPlanOut(BaseModel):
    id: int
    week_start: datetime
    plan_json: List[DayPlan]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class SuggestionOut(BaseModel):
    id: int
    trigger_reason: str
    status: SuggestionStatus
    llm_message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- WeakTopic Engine outputs ---
class TopicHealth(BaseModel):
    weak: List[TopicScoreOut]
    improving: List[TopicScoreOut]
    strong: List[TopicScoreOut]

# --- Dashboard Schemas ---
class StreakData(BaseModel):
    current: int
    longest: int
    last_active: datetime

class DashboardOut(BaseModel):
    user: Dict[str, Any]
    streak: StreakData
    today_plan: Optional[DayPlan]
    topic_health: Dict[str, List[Dict[str, Any]]] # subject -> List of topics with scores
    radar_data: Dict[str, float]
    pending_suggestions: List[SuggestionOut]
    weekly_test_available: bool
    recent_test_summary: Optional[Dict[str, Any]]
    cheer_message: Optional[str]
