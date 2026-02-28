import os
import sys
import json

# Add backend dir to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, SessionLocal, Base
from backend.models import Topic, Question, Subject, QuestionDifficulty

Base.metadata.create_all(bind=engine)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "knowledge_base")

def clean_correct_option(option: str) -> str:
    # Some options in the json are full strings instead of "A", "B", "C", "D"
    option = str(option).strip().upper()
    if option in ["A", "B", "C", "D"]:
        return option
    # Fallback/heuristic if data is corrupted
    if option.startswith("A"): return "A"
    if option.startswith("B"): return "B"
    if option.startswith("C"): return "C"
    if option.startswith("D"): return "D"
    return "A" # Default fallback


def map_difficulty(diff_str: str) -> QuestionDifficulty:
    diff_str = str(diff_str).lower().strip()
    if diff_str == "medium":
        return QuestionDifficulty.MEDIUM
    elif diff_str == "hard":
        return QuestionDifficulty.HARD
    return QuestionDifficulty.EASY


def map_subject(subject_dir_name: str) -> Subject:
    db_map = {
        "physics": Subject.PHYSICS,
        "chemistry": Subject.CHEMISTRY,
        "math": Subject.MATH,
        "biology": Subject.BIOLOGY
    }
    return db_map.get(subject_dir_name.lower(), Subject.PHYSICS)


def seed_database():
    db = SessionLocal()
    
    # Check if already seeded
    if db.query(Topic).first():
        print("Database already seeded. Exiting.")
        db.close()
        return

    print("Seeding database...")
    topic_count = 0
    question_count = 0

    if not os.path.exists(DATA_DIR):
        print(f"Data directory {DATA_DIR} does not exist. Skipping seed.")
        db.close()
        return

    for subject_dir in os.listdir(DATA_DIR):
        subject_path = os.path.join(DATA_DIR, subject_dir)
        if not os.path.isdir(subject_path):
            continue
            
        subject_enum = map_subject(subject_dir)

        for filename in os.listdir(subject_path):
            if filename.endswith(".json"):
                file_path = os.path.join(subject_path, filename)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        
                        # Calculate difficulty average for the topic
                        # let easy=1, medium=2, hard=3
                        questions_data = data.get("questions", [])
                        total_diff = 0
                        for q in questions_data:
                            d = str(q.get("difficulty", "easy")).lower()
                            if d == "medium": total_diff += 2
                            elif d == "hard": total_diff += 3
                            else: total_diff += 1
                            
                        diff_avg = total_diff / len(questions_data) if questions_data else 1.0
                        
                        topic_name = data.get("topic", filename.replace(".json", ""))

                        # Create Topic
                        new_topic = Topic(
                            subject=subject_enum,
                            name=topic_name,
                            theory_summary=data.get("summary", ""),
                            difficulty_avg=diff_avg
                        )
                        db.add(new_topic)
                        db.flush() # get topic ID
                        topic_count += 1
                        
                        # Create Questions
                        for q_data in questions_data:
                            options = q_data.get("options", {})
                            new_question = Question(
                                topic_id=new_topic.id,
                                question_text=q_data.get("question", ""),
                                option_a=str(options.get("A", "")),
                                option_b=str(options.get("B", "")),
                                option_c=str(options.get("C", "")),
                                option_d=str(options.get("D", "")),
                                correct_option=clean_correct_option(q_data.get("correct_option", "A")),
                                difficulty=map_difficulty(q_data.get("difficulty", "easy")),
                                explanation=q_data.get("explanation", "")
                            )
                            db.add(new_question)
                            question_count += 1
                            
                except Exception as e:
                    print(f"Error parsing {file_path}: {e}")
                    
    db.commit()
    db.close()
    print(f"Successfully inserted {topic_count} topics and {question_count} questions.")

if __name__ == "__main__":
    seed_database()
