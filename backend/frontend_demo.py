import streamlit as st
import requests
import json
import sseclient # pip install sseclient-py

API_BASE = "http://localhost:8000/api"

st.set_page_config(page_title="EduCoach Backend Demo", layout="wide")

if "token" not in st.session_state:
    st.session_state.token = None
    
if "user" not in st.session_state:
    st.session_state.user = None

def load_auth_headers():
    if st.session_state.token:
        return {"Authorization": f"Bearer {st.session_state.token}"}
    return {}

st.title("EduCoach API Tester & Demo")

# --- AUTH ---
with st.sidebar:
    st.header("Authentication")
    if not st.session_state.token:
        tab1, tab2 = st.tabs(["Login", "Sign Up"])
        with tab1:
            l_email = st.text_input("Email", key="l_email")
            l_pass = st.text_input("Password", type="password", key="l_pass")
            if st.button("Login"):
                res = requests.post(f"{API_BASE}/auth/login", data={"username": l_email, "password": l_pass})
                if res.status_code == 200:
                    st.session_state.token = res.json()["access_token"]
                    # Fetch Profile
                    u_res = requests.get(f"{API_BASE}/user/me", headers={"Authorization": f"Bearer {st.session_state.token}"})
                    st.session_state.user = u_res.json()
                    st.success("Logged In!")
                    st.rerun()
                else:
                    st.error(res.text)
        with tab2:
            s_name = st.text_input("Name")
            s_email = st.text_input("Email")
            s_pass = st.text_input("Password", type="password")
            s_type = st.selectbox("Exam Type", ["JEE", "NEET", "BOTH"])
            s_hours = st.number_input("Daily Hours", value=2.0)
            if st.button("Sign Up"):
                payload = {"name": s_name, "email": s_email, "password": s_pass, "exam_type": s_type, "daily_hours": s_hours}
                res = requests.post(f"{API_BASE}/auth/signup", json=payload)
                if res.status_code == 200:
                    st.success("Signed up successfully! You can now login.")
                else:
                    st.error(res.text)
    else:
        st.write(f"Logged in as: **{st.session_state.user['name']}**")
        if st.button("Logout"):
            st.session_state.token = None
            st.session_state.user = None
            st.rerun()

if not st.session_state.token:
    st.warning("Please login to test the API.")
    st.stop()

# --- MAIN DASHBOARD ---
tab_dash, tab_tests, tab_plans, tab_tutor, tab_yt = st.tabs(["Dashboard", "Tests", "Study Plans", "AI Tutor", "YouTube Search"])

with tab_dash:
    st.header("Home Dashboard Data")
    if st.button("Fetch Dashboard Data"):
        res = requests.get(f"{API_BASE}/user/dashboard", headers=load_auth_headers())
        if res.status_code == 200:
            data = res.json()
            col1, col2 = st.columns(2)
            with col1:
                st.subheader("Streak")
                st.json(data["streak"])
                st.subheader("Topic Health")
                st.write(f"Weak Topics: {len(data['topic_health'].get('Physics', [])) + len(data['topic_health'].get('Chemistry', [])) + len(data['topic_health'].get('Math', []))} found across subjects.")
            with col2:
                st.subheader("Pending Suggestions")
                st.json(data["pending_suggestions"])
                st.subheader("Cheer Message")
                st.info(data["cheer_message"] or "No unread cheers.")
            st.subheader("Full JSON")
            st.json(data)
        else:
            st.error(f"Failed to fetch dashboard: {res.text}")

with tab_tests:
    st.header("Test Generation & Submission")
    t_opt = st.radio("Test Type", ["Topic Test", "Quick Mock"])
    if t_opt == "Topic Test":
        t_id = st.number_input("Topic ID", value=1, min_value=1)
        t_count = st.number_input("Count", value=5, min_value=1, max_value=20)
        t_diff = st.selectbox("Difficulty", ["easy", "medium", "hard", "mixed"])
        if st.button("Generate Topic Test"):
            res = requests.post(f"{API_BASE}/tests/generate/topic", json={"topic_id": t_id, "count": t_count, "difficulty": t_diff}, headers=load_auth_headers())
            if res.status_code == 200:
                st.session_state.current_test = res.json()
                st.success(f"Generated Test ID: {st.session_state.current_test['test_id']}")
            else:
                st.error(res.text)

    if "current_test" in st.session_state:
        st.write("---")
        st.subheader(f"Active Test: #{st.session_state.current_test['test_id']}")
        
        with st.form("test_submission"):
            answers = []
            for i, q in enumerate(st.session_state.current_test["questions"]):
                st.write(f"**Q{i+1}: {q['question_text']}**")
                opts = [f"A. {q['option_a']}", f"B. {q['option_b']}", f"C. {q['option_c']}", f"D. {q['option_d']}"]
                choice = st.radio("Options", ["None"] + opts, key=f"q_{q['id']}")
                
                ans_char = None
                if choice != "None":
                    ans_char = choice[0] # "A", "B", etc.
                    
                answers.append({
                    "question_id": q["id"],
                    "user_answer": ans_char,
                    "time_spent_seconds": 30
                })
                
            if st.form_submit_button("Submit Test"):
                payload = {
                    "test_id": st.session_state.current_test["test_id"],
                    "answers": answers
                }
                sub_res = requests.post(f"{API_BASE}/tests/submit", json=payload, headers=load_auth_headers())
                if sub_res.status_code == 200:
                    st.success(f"Test Submitted! Score: {sub_res.json()['score']}%")
                    st.json(sub_res.json())
                    del st.session_state["current_test"]
                else:
                    st.error(sub_res.text)

with tab_plans:
    st.header("Study Plans & Suggestions")
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Generate LLM Study Plan"):
            with st.spinner("Ollama is thinking..."):
                res = requests.post(f"{API_BASE}/plans/generate", headers=load_auth_headers())
                if res.status_code == 200:
                    st.success("Plan generated!")
                    st.json(res.json())
                else:
                    st.error(res.text)
                    
    with col2:
        if st.button("Get Current Plan"):
            res = requests.get(f"{API_BASE}/plans/current", headers=load_auth_headers())
            if res.status_code == 200:
                data = res.json()
                if data:
                    st.json(data)
                else:
                    st.info("No active plan.")
            else:
                st.error(res.text)

with tab_tutor:
    st.header("AI Tutor (Streaming locally via Ollama)")
    q_id = st.number_input("Question ID to Explain", value=1, min_value=1)
    ans = st.text_input("What did you answer?", value="A")
    
    if st.button("Explain Why I'm Wrong"):
        with st.spinner("Connecting to Local LLM..."):
            try:
                res = requests.post(
                    f"{API_BASE}/llm/explain", 
                    json={"question_id": q_id, "user_answer": ans},
                    headers=load_auth_headers(),
                    stream=True
                )
                if res.status_code == 200:
                    st.write("### AI Response:")
                    
                    # Read streaming response chunks and update UI
                    output = st.empty()
                    text = ""
                    for chunk in res.iter_content(chunk_size=1024):
                        if chunk:
                            text += chunk.decode('utf-8')
                            output.markdown(text)
                else:
                    st.error(f"Error {res.status_code}: {res.text}")
            except Exception as e:
                st.error(f"Connection failed: {str(e)}")

with tab_yt:
    st.header("YouTube Search Integration")
    yt_query = st.text_input("Topic Name", value="Kinematics")
    if st.button("Search Videos"):
        with st.spinner("Searching..."):
            res = requests.get(f"{API_BASE}/youtube/{yt_query}", headers=load_auth_headers())
            if res.status_code == 200:
                data = res.json()
                for vid in data:
                    st.markdown(f"**[{vid['title']}]({vid['url']})**")
                    if vid['thumbnail']:
                        st.image(vid['thumbnail'], width=200)
                    st.write(f"Channel: {vid['channel_name']}")
                    st.write("---")
            else:
                st.error(res.text)
