from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Enum, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base

class ExamType(str, enum.Enum):
    JEE = "JEE"
    NEET = "NEET"
    BOTH = "BOTH"

class Subject(str, enum.Enum):
    PHYSICS = "Physics"
    CHEMISTRY = "Chemistry"
    MATH = "Math"
    BIOLOGY = "Biology"

class QuestionDifficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class TestType(str, enum.Enum):
    QUICK = "quick"
    CUSTOM = "custom"
    TOPIC = "topic"
    WEEKLY = "weekly"
    PROCTOR = "proctor"

class SuggestionStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"

class NotificationType(str, enum.Enum):
    STREAK = "streak"
    SUGGESTION = "suggestion"
    WEEKLY = "weekly"
    BREAK = "break"
    CHEER = "cheer"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    exam_type = Column(Enum(ExamType))
    daily_hours = Column(Float, default=2.0)
    exam_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    mock_tests = relationship("MockTest", back_populates="user")
    topic_scores = relationship("TopicScore", back_populates="user")
    study_plans = relationship("StudyPlan", back_populates="user")
    streak = relationship("Streak", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(Enum(Subject), index=True)
    name = Column(String, unique=True, index=True)
    theory_summary = Column(Text)
    difficulty_avg = Column(Float, default=0.0)

    questions = relationship("Question", back_populates="topic")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"))
    question_text = Column(String)
    option_a = Column(String)
    option_b = Column(String)
    option_c = Column(String)
    option_d = Column(String)
    correct_option = Column(String) # "A", "B", "C", "D"
    difficulty = Column(Enum(QuestionDifficulty), index=True)
    explanation = Column(Text, nullable=True)

    topic = relationship("Topic", back_populates="questions")


class MockTest(Base):
    __tablename__ = "mock_tests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(Enum(TestType), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    score = Column(Float, nullable=True)
    total_questions = Column(Integer, default=0)
    time_taken_seconds = Column(Integer, nullable=True)
    is_completed = Column(Boolean, default=False)

    user = relationship("User", back_populates="mock_tests")
    test_questions = relationship("TestQuestion", back_populates="test")


class TestQuestion(Base):
    __tablename__ = "test_questions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("mock_tests.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    user_answer = Column(String, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    time_spent_seconds = Column(Integer, default=0)

    test = relationship("MockTest", back_populates="test_questions")
    question = relationship("Question")


class TopicScore(Base):
    __tablename__ = "topic_scores"
    __table_args__ = (UniqueConstraint("user_id", "topic_id", name="_user_topic_uc"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"))
    score = Column(Float, default=50.0)
    last_updated = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="topic_scores")
    topic = relationship("Topic")


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    week_start = Column(DateTime, default=datetime.utcnow)
    plan_json = Column(Text) # JSON string
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="study_plans")


class ScheduleSuggestion(Base):
    __tablename__ = "schedule_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    trigger_reason = Column(String)
    suggested_plan_json = Column(Text)
    status = Column(Enum(SuggestionStatus), default=SuggestionStatus.PENDING)
    llm_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class WeeklyTest(Base):
    __tablename__ = "weekly_tests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    week_number = Column(Integer)
    test_id = Column(Integer, ForeignKey("mock_tests.id"))
    generated_at = Column(DateTime, default=datetime.utcnow)
    is_attempted = Column(Boolean, default=False)
    
    test = relationship("MockTest")


class QuestionExplanation(Base):
    __tablename__ = "question_explanations"
    __table_args__ = (UniqueConstraint("user_id", "question_id", name="_user_question_uc"),)

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    explanation_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Streak(Base):
    __tablename__ = "streaks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_active_date = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="streak")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    type = Column(Enum(NotificationType))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
