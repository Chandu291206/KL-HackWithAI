"""
test_app.py — EduCoach CV Webcam Tester
Real-time drowsiness + head pose detection using your webcam.

Install dependencies:
    python -m pip install streamlit opencv-python mediapipe numpy pandas

Run:
    python -m streamlit run test_app.py
"""

import streamlit as st
import cv2
import mediapipe as mp
from mediapipe import solutions as mp_solutions
import numpy as np
import pandas as pd
import time
from collections import deque

# ─────────────────────────────────────────────
# Page config
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="EduCoach CV Tester",
    page_icon="👁️",
    layout="wide",
)

st.title("👁️ EduCoach CV — Webcam Tester")
st.caption("Real-time drowsiness + head pose + burnout detection")

# ─────────────────────────────────────────────
# MediaPipe setup
# ─────────────────────────────────────────────
mp_face_mesh = mp_solutions.face_mesh
mp_drawing   = mp_solutions.drawing_utils
mp_styles    = mp_solutions.drawing_styles

# ─────────────────────────────────────────────
# Landmark indices
# ─────────────────────────────────────────────
LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]

NOSE_TIP      = 1
CHIN          = 199
LEFT_EYE_OUT  = 263
RIGHT_EYE_OUT = 33
FOREHEAD      = 10

# ─────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────
def dist(a, b):
    return np.sqrt((a.x - b.x)**2 + (a.y - b.y)**2)

def compute_ear(lm, indices):
    p  = [lm[i] for i in indices]
    v1 = dist(p[1], p[5])
    v2 = dist(p[2], p[4])
    h  = dist(p[0], p[3])
    return (v1 + v2) / (2.0 * h) if h > 1e-6 else 0.0

def compute_head_pose(lm):
    nose     = lm[NOSE_TIP]
    chin     = lm[CHIN]
    l_eye    = lm[LEFT_EYE_OUT]
    r_eye    = lm[RIGHT_EYE_OUT]
    forehead = lm[FOREHEAD]

    face_w = abs(l_eye.x - r_eye.x)
    face_h = abs(chin.y - forehead.y)
    if face_w < 1e-6 or face_h < 1e-6:
        return 0.0, 0.0, 0.0

    eye_mid_x = (l_eye.x + r_eye.x) / 2
    yaw   = ((nose.x - eye_mid_x) / face_w) * 90
    mid_y = (forehead.y + chin.y) / 2
    pitch = -((nose.y - mid_y) / face_h) * 90
    dx    = r_eye.x - l_eye.x
    dy    = r_eye.y - l_eye.y
    roll  = np.degrees(np.arctan2(dy, dx))

    return round(yaw, 1), round(pitch, 1), round(roll, 1)

def draw_hud(frame, ear, yaw, pitch, roll, closed_frames, blink_count, status, ear_thresh, drowsy_f):
    h, w   = frame.shape[:2]
    overlay = frame.copy()

    # Semi-transparent dark background for HUD
    cv2.rectangle(overlay, (0, 0), (285, 180), (15, 15, 15), -1)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)

    color_map = {
        "FOCUSED":   (50, 210, 50),
        "DROWSY":    (0, 140, 255),
        "LOOK AWAY": (0, 140, 255),
        "NO FACE":   (0, 0, 200),
    }
    c = color_map.get(status, (180, 180, 180))

    cv2.putText(frame, f"[ {status} ]",      (10, 30),  cv2.FONT_HERSHEY_SIMPLEX, 0.7,  c,           2)
    cv2.putText(frame, f"EAR   : {ear:.3f}", (10, 60),  cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200,200,200), 1)
    cv2.putText(frame, f"Yaw   : {yaw:.1f}°",(10, 85),  cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200,200,200), 1)
    cv2.putText(frame, f"Pitch : {pitch:.1f}°",(10,110), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200,200,200), 1)
    cv2.putText(frame, f"Roll  : {roll:.1f}°", (10,135), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200,200,200), 1)
    cv2.putText(frame, f"Blinks: {blink_count}", (10,160), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200,200,200), 1)

    # EAR progress bar (top-right)
    bar_max   = 180
    bar_val   = int(np.clip(ear / 0.40, 0, 1) * bar_max)
    bar_color = (50, 210, 50) if ear >= ear_thresh else (0, 140, 255)
    cv2.rectangle(frame, (w - bar_max - 15, 12), (w - 15, 28), (50, 50, 50), -1)
    cv2.rectangle(frame, (w - bar_max - 15, 12), (w - bar_max - 15 + bar_val, 28), bar_color, -1)
    cv2.putText(frame, "EAR", (w - bar_max - 15, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (130,130,130), 1)

    # Drowsy frame counter bar
    bar_d = int(np.clip(closed_frames / drowsy_f, 0, 1) * bar_max)
    cv2.rectangle(frame, (w - bar_max - 15, 55), (w - 15, 71), (50, 50, 50), -1)
    cv2.rectangle(frame, (w - bar_max - 15, 55), (w - bar_max - 15 + bar_d, 71), (0, 140, 255), -1)
    cv2.putText(frame, "Drowsy", (w - bar_max - 15, 89), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (130,130,130), 1)

    return frame

# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
# BurnoutEngine v2 — Momentum + Compound Scoring
#
# Core philosophy:
#   Score = fatigue_pool (live, event-driven) + context_floor (static)
#   fatigue_pool  → spikes on bad events, decays during good behavior
#   context_floor → set by self-report / plan / schedule (minimum score)
#   Compound rule → drowsy + wrong answer = multiplied penalty, not additive
# ─────────────────────────────────────────────
class BurnoutEngine:

    BREAK_DURATION_SECS = 15 * 60

    # ── Spike values (added to fatigue pool per event) ────────────────────
    SPIKE = {
        "drowsy_event":          18,   # camera: eyes closed too long
        "wrong_while_drowsy":    22,   # compound: wrong answer during drowsy window
        "slow_and_wrong":        12,   # time_ratio>1.3 AND wrong (but NOT drowsy)
        "consecutive_wrongs":    10,   # 3+ wrong answers in a row on strong topics
        "explain_click":          5,   # hit explain on a question
        "answer_change_spike":    6,   # revision rate 2x above baseline
    }

    # ── Decay rate ────────────────────────────────────────────────────────
    # Points the pool loses per CORRECT answer on a strong topic
    CORRECT_HEAL      =  4
    # Points lost per minute of no bad events (passive recovery)
    PASSIVE_DECAY_MIN =  2

    # ── Context floor weights ─────────────────────────────────────────────
    # These signals set the MINIMUM the score can decay to
    FLOOR_WEIGHTS = {
        "self_report":     20,   # 1=Fresh→0, 4=Exhausted→20
        "plan_decay":       8,   # week-over-week completion drop
        "schedule_strain":  7,   # consecutive days + late nights
    }
    # Max floor = 35 (leaves headroom for fatigue pool to show improvement)

    def __init__(self):
        self.reset()

    def reset(self):
        self.session_start  = time.time()
        self.break_start    = None
        self.on_break       = False
        self.last_break_end = None
        self.break_count    = 0
        self.break_notified = False
        self.last_score     = 0.0
        self.score_history  = deque(maxlen=300)

        # ── Fatigue pool (live, 0–65 range) ─────────────────────────────────
        self.fatigue_pool         = 0.0
        self.last_decay_time      = time.time()
        self.last_bad_event_time  = None

        # ── Drowsy context window (30s) ───────────────────────────────────────
        # If a wrong answer lands within 30s of a drowsy event = compound penalty
        self.last_drowsy_time     = None
        self.DROWSY_CONTEXT_SECS  = 30

        # ── Consecutive wrong streak on strong topics ────────────────────────
        self.consec_wrong_strong  = 0

        # ── Answer revision tracking ──────────────────────────────────────────
        self.answers_changed      = 0
        self.answers_submitted    = 0
        self.personal_revision_baseline = 0.10
        self._revision_spike_fired = False

        # ── Explain clicks ────────────────────────────────────────────────────
        self.explain_clicks       = 0
        self.questions_seen       = 0
        self.personal_explain_baseline = 0.15

        # ── Context floor inputs ──────────────────────────────────────────────
        self.self_report_value         = 1    # 1=Fresh … 4=Exhausted
        self.plan_completion_this_week = 1.0
        self.plan_completion_last_week = 1.0
        self.consecutive_study_days    = 0
        self.late_night_sessions       = 0

        # ── Audit log (for breakdown UI) ─────────────────────────────────────
        self.event_log  = deque(maxlen=50)
        self.total_drowsy_events = 0

    # ─────────────────────────────────────────────────────────────────────
    # Context setters
    # ─────────────────────────────────────────────────────────────────────
    def set_self_report(self, value: int):
        self.self_report_value = max(1, min(4, value))

    def set_plan_completion(self, this_week: float, last_week: float):
        self.plan_completion_this_week = this_week
        self.plan_completion_last_week = last_week

    def set_schedule(self, consecutive_days: int, late_nights: int):
        self.consecutive_study_days = consecutive_days
        self.late_night_sessions    = late_nights

    def set_personal_baselines(self, revision_rate: float, explain_rate: float):
        self.personal_revision_baseline = revision_rate
        self.personal_explain_baseline  = explain_rate

    # ─────────────────────────────────────────────────────────────────────
    # Event triggers — call these as things happen
    # ─────────────────────────────────────────────────────────────────────
    def log_drowsy_event(self):
        """Camera detected sustained eye closure."""
        spike = self.SPIKE["drowsy_event"]
        self.fatigue_pool      = min(65, self.fatigue_pool + spike)
        self.last_drowsy_time  = time.time()
        self.last_bad_event_time = time.time()
        self.total_drowsy_events += 1
        self._log(f"😴 Drowsy event (+{spike})")

    def log_question_result(self, is_wrong: bool, time_ratio: float,
                             is_strong: bool):
        """
        Call after each question is answered.
        is_strong = topic_score > 70
        time_ratio = time_spent / personal_avg_for_difficulty
        """
        self.questions_seen += 1
        now = time.time()

        if is_wrong:
            # Check if within drowsy context window → compound penalty
            in_drowsy_window = (
                self.last_drowsy_time is not None and
                (now - self.last_drowsy_time) <= self.DROWSY_CONTEXT_SECS
            )

            if in_drowsy_window:
                spike = self.SPIKE["wrong_while_drowsy"]
                self.fatigue_pool = min(65, self.fatigue_pool + spike)
                self.last_bad_event_time = now
                self._log(f"💥 Wrong WHILE drowsy! (+{spike}) — compound hit")

            elif time_ratio > 1.3:
                # Slow AND wrong (but not during drowsy window)
                spike = self.SPIKE["slow_and_wrong"]
                self.fatigue_pool = min(65, self.fatigue_pool + spike)
                self.last_bad_event_time = now
                self._log(f"🐢 Slow+wrong (+{spike})")

            # Consecutive wrong streak on strong topics
            if is_strong:
                self.consec_wrong_strong += 1
                if self.consec_wrong_strong == 3:
                    spike = self.SPIKE["consecutive_wrongs"]
                    self.fatigue_pool = min(65, self.fatigue_pool + spike)
                    self.last_bad_event_time = now
                    self._log(f"📉 3 wrong in a row on strong topic (+{spike})")
            else:
                self.consec_wrong_strong = 0

        else:
            # Correct answer on strong topic → heal pool
            if is_strong:
                self.fatigue_pool = max(0, self.fatigue_pool - self.CORRECT_HEAL)
                self._log(f"✅ Correct (strong topic) (-{self.CORRECT_HEAL})")
            self.consec_wrong_strong = 0

    def log_answer_change(self):
        self.answers_changed += 1
        # Check if revision rate has spiked above 2x baseline
        if self.answers_submitted > 3:
            rate     = self.answers_changed / self.answers_submitted
            baseline = self.personal_revision_baseline or 0.10
            if rate > baseline * 2 and not self._revision_spike_fired:
                self._revision_spike_fired = True
                spike = self.SPIKE["answer_change_spike"]
                self.fatigue_pool = min(65, self.fatigue_pool + spike)
                self._log(f"🔄 Revision spike (+{spike})")

    def log_answer_submit(self):
        self.answers_submitted += 1
        self._revision_spike_fired = False   # reset per question

    def log_explain_click(self):
        self.explain_clicks += 1
        spike = self.SPIKE["explain_click"]
        self.fatigue_pool = min(65, self.fatigue_pool + spike)
        self._log(f"🤖 Explain click (+{spike})")

    # ─────────────────────────────────────────────────────────────────────
    # Main compute — call every frame / every few seconds
    # ─────────────────────────────────────────────────────────────────────
    def compute(self) -> dict:
        now = time.time()

        # ── Passive decay ─────────────────────────────────────────────────────
        # Pool loses PASSIVE_DECAY_MIN pts per minute with no bad events
        mins_since_last_tick = (now - self.last_decay_time) / 60.0
        if mins_since_last_tick >= 0.05:   # tick every 3 seconds minimum
            decay = self.PASSIVE_DECAY_MIN * mins_since_last_tick
            self.fatigue_pool   = max(0, self.fatigue_pool - decay)
            self.last_decay_time = now

        # ── Context floor ─────────────────────────────────────────────────────
        floor = self._compute_floor()

        # ── Final score ───────────────────────────────────────────────────────
        # Score = max(floor, fatigue_pool + floor_contribution)
        # Floor acts as both a minimum AND adds to the fatigue pool
        total = min(100, self.fatigue_pool + floor)

        self.last_score = total
        self.score_history.append(total)

        return {
            "total":        round(total, 1),
            "fatigue_pool": round(self.fatigue_pool, 1),
            "floor":        round(floor, 1),
            "signals": {
                "fatigue_pool":    round(self.fatigue_pool, 1),
                "self_report":     round(self._floor_self_report(), 1),
                "plan_decay":      round(self._floor_plan(), 1),
                "schedule_strain": round(self._floor_schedule(), 1),
            }
        }

    # ─────────────────────────────────────────────────────────────────────
    # Floor computation (static context signals)
    # ─────────────────────────────────────────────────────────────────────
    def _compute_floor(self):
        return round(
            self._floor_self_report() +
            self._floor_plan() +
            self._floor_schedule(), 1
        )

    def _floor_self_report(self):
        w = self.FLOOR_WEIGHTS["self_report"]
        return ((self.self_report_value - 1) / 3) * w

    def _floor_plan(self):
        w = self.FLOOR_WEIGHTS["plan_decay"]
        if self.plan_completion_last_week <= 0:
            return 0.0
        drop = max(0.0, self.plan_completion_last_week - self.plan_completion_this_week)
        return min(w, (drop / 0.40) * w)

    def _floor_schedule(self):
        w = self.FLOOR_WEIGHTS["schedule_strain"]
        day_score   = min(4.0, max(0, self.consecutive_study_days - 6) / 4 * 4)
        night_score = min(3.0, self.late_night_sessions / 4 * 3)
        return min(w, day_score + night_score)

    # ─────────────────────────────────────────────────────────────────────
    # Break management
    # ─────────────────────────────────────────────────────────────────────
    def should_notify_break(self):
        if self.on_break:
            return False
        if self.last_score >= 60 and not self.break_notified:
            self.break_notified = True
            return True
        return False

    def start_break(self):
        self.on_break    = True
        self.break_start = time.time()
        self.break_count += 1

    def end_break(self):
        self.on_break        = False
        self.last_break_end  = time.time()
        self.break_notified  = False
        # Break heals the fatigue pool significantly (not to zero — floor remains)
        self.fatigue_pool    = max(0, self.fatigue_pool * 0.2)
        self.last_drowsy_time = None
        self.consec_wrong_strong = 0
        self._revision_spike_fired = False
        self.event_log.clear()
        self._log("☕ Break taken — pool reset")

    def break_time_remaining(self):
        if not self.on_break or not self.break_start:
            return 0
        return max(0, int(self.BREAK_DURATION_SECS - (time.time() - self.break_start)))

    def get_stats(self):
        result = self.compute()
        return {
            "burnout_score":   result["total"],
            "fatigue_pool":    result["fatigue_pool"],
            "floor":           result["floor"],
            "signals":         result["signals"],
            "break_count":     self.break_count,
            "questions_seen":  self.questions_seen,
            "explain_clicks":  self.explain_clicks,
            "answers_changed": self.answers_changed,
            "drowsy_total":    self.total_drowsy_events,
            "event_log":       list(self.event_log),
        }

    @staticmethod
    def score_label(score):
        if score < 25: return ("🟢 Fresh",      "normal")
        if score < 50: return ("🟡 Tiring",     "warning")
        if score < 75: return ("🟠 Fatigued",   "warning")
        return             ("🔴 Burnt Out",  "error")

    def _log(self, msg):
        self.event_log.append(f"{time.strftime('%H:%M:%S')} {msg}")

# ─────────────────────────────────────────────
# Session state
# ─────────────────────────────────────────────
defaults = {
    "running":        False,
    "blink_count":    0,
    "drowsy_events":  0,
    "look_events":    0,
    "start_time":     None,
    "ear_history":    deque(maxlen=120),
    "yaw_history":    deque(maxlen=120),
    "alert_log":      [],
    "burnout":        BurnoutEngine(),
    "on_break":       False,
    "burnout_score":  0.0,
    # Simulator state for non-camera signals
    "sim_q_index":    0,
    "sim_answer":     None,
    "sim_prev_answer":None,
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ─────────────────────────────────────────────
# Sidebar
# ─────────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ Thresholds")
    ear_thresh   = st.slider("EAR Threshold",    0.10, 0.35, 0.22, 0.01)
    yaw_thresh   = st.slider("Yaw Threshold °",  10,   60,   28,   1)
    pitch_thresh = st.slider("Pitch Threshold °", 10,  45,   22,   1)
    drowsy_f     = st.slider("Drowsy Frames",    5,    40,   15,   1)

    st.divider()
    st.header("🎨 Display")
    show_mesh = st.checkbox("Face mesh",   value=False)
    show_iris = st.checkbox("Iris points", value=True)
    mirror    = st.checkbox("Mirror",      value=True)

    st.divider()
    st.header("🔥 Burnout Signals")

    # ── Signal 1: Self Report ────────────────────────────────────────────────
    st.markdown("**1. How are you feeling?**")
    self_report = st.radio(
        "self_report", ["😊 Fresh", "😐 Okay", "😓 Tired", "😴 Exhausted"],
        horizontal=True, label_visibility="collapsed"
    )
    self_report_val = ["😊 Fresh","😐 Okay","😓 Tired","😴 Exhausted"].index(self_report) + 1
    st.session_state.burnout.set_self_report(self_report_val)

    st.divider()

    # ── Signal 5: Plan Decay ─────────────────────────────────────────────────
    st.markdown("**5. Plan completion rates**")
    plan_last = st.slider("Last week %", 0, 100, 85) / 100
    plan_this = st.slider("This week %", 0, 100, 60) / 100
    st.session_state.burnout.set_plan_completion(plan_this, plan_last)

    # ── Signal 7: Schedule Strain ────────────────────────────────────────────
    st.markdown("**7. Schedule strain**")
    consec_days  = st.slider("Consecutive study days", 0, 14, 3)
    late_nights  = st.slider("Late-night sessions this week", 0, 7, 0)
    st.session_state.burnout.set_schedule(consec_days, late_nights)

    st.divider()
    st.header("📊 Session Stats")
    burnout_score_ph = st.empty()
    burnout_bar_ph   = st.empty()
    burnout_label_ph = st.empty()
    st.caption("Weights: self_report=40, speed_acc=15,\nstrong_decay=15, revision=10,\nplan=10, explain=5, schedule=5")
    stat_blinks = st.empty()
    stat_drowsy = st.empty()
    stat_look   = st.empty()
    stat_alerts = st.empty()
    stat_time   = st.empty()
    stat_blink_rate = st.empty()
    stat_breaks = st.empty()

    if st.button("🔄 Reset Stats", use_container_width=True):
        st.session_state.blink_count   = 0
        st.session_state.drowsy_events = 0
        st.session_state.look_events   = 0
        st.session_state.alert_log     = []
        st.session_state.start_time    = time.time()
        st.session_state.ear_history   = deque(maxlen=120)
        st.session_state.yaw_history   = deque(maxlen=120)
        st.session_state.burnout       = BurnoutEngine()
        st.session_state.burnout_score = 0.0

    if st.button("☕ Take a Break Now", use_container_width=True):
        st.session_state.burnout.start_break()
        st.session_state.on_break = True

# ─────────────────────────────────────────────
# Layout
# ─────────────────────────────────────────────
col_cam, col_right = st.columns([3, 2])

with col_cam:
    c1, c2 = st.columns(2)
    start_btn = c1.button("▶ Start Camera", use_container_width=True, type="primary")
    stop_btn  = c2.button("⏹ Stop",         use_container_width=True)
    cam_ph    = st.empty()

with col_right:
    st.markdown("#### 🔥 Burnout Monitor")
    burnout_panel_ph = st.empty()

    st.markdown("#### 🧪 Signal Simulator")
    st.caption("Simulate events — each one spikes the fatigue pool in real time")

    sim_tab1, sim_tab2 = st.tabs(["📝 Answer Questions", "📊 Event Log"])

    with sim_tab1:
        st.markdown("**Simulate answering a question:**")
        col_a, col_b = st.columns(2)
        time_ratio  = col_a.slider("Time ratio vs your avg", 0.5, 3.0, 1.0, 0.1,
                                    help=">1.3 = slower than usual")
        topic_score = col_b.slider("Topic score (0–100)", 0, 100, 75,
                                    help=">70 = strong topic")
        is_wrong    = st.checkbox("Got it wrong")
        is_strong   = topic_score > 70

        st.caption(f"Question #{st.session_state.sim_q_index + 1}")

        col_s1, col_s2, col_s3 = st.columns(3)

        if col_s1.button("✅ Submit Answer"):
            st.session_state.burnout.log_question_result(
                is_wrong=is_wrong, time_ratio=time_ratio, is_strong=is_strong
            )
            st.session_state.burnout.log_answer_submit()
            st.session_state.sim_q_index += 1
            st.rerun()

        if col_s2.button("🔄 Change Answer"):
            st.session_state.burnout.log_answer_change()
            st.rerun()

        if col_s3.button("🤖 Explain This"):
            st.session_state.burnout.log_explain_click()
            st.session_state.burnout.log_question_result(
                is_wrong=True, time_ratio=time_ratio, is_strong=is_strong
            )
            st.session_state.sim_q_index += 1
            st.rerun()

        if st.button("😴 Simulate Drowsy Event"):
            st.session_state.burnout.log_drowsy_event()
            st.session_state.drowsy_events += 1
            st.rerun()

        if st.button("🔁 Reset All", use_container_width=True):
            st.session_state.sim_q_index = 0
            st.session_state.burnout     = BurnoutEngine()
            # re-apply sidebar context
            st.session_state.burnout.set_self_report(self_report_val)
            st.session_state.burnout.set_plan_completion(plan_this, plan_last)
            st.session_state.burnout.set_schedule(consec_days, late_nights)
            st.rerun()

        b = st.session_state.burnout
        st.markdown(f"""
        | Metric | Value |
        |---|---|
        | Questions answered | {b.questions_seen} |
        | Answer changes | {b.answers_changed} |
        | Explain clicks | {b.explain_clicks} |
        | Drowsy events (total) | {b.total_drowsy_events} |
        | Fatigue pool | {b.fatigue_pool:.1f} / 65 |
        """)

    with sim_tab2:
        stats   = st.session_state.burnout.get_stats()
        signals = stats["signals"]

        # Fatigue pool vs floor bar chart
        breakdown_df = pd.DataFrame([
            {"Component": "Fatigue Pool (live)",  "Score": stats["fatigue_pool"]},
            {"Component": "Self Report (floor)",  "Score": signals["self_report"]},
            {"Component": "Plan Decay (floor)",   "Score": signals["plan_decay"]},
            {"Component": "Schedule (floor)",     "Score": signals["schedule_strain"]},
        ])
        st.dataframe(breakdown_df, use_container_width=True, hide_index=True)
        st.bar_chart(breakdown_df.set_index("Component")["Score"], height=180)

        st.markdown("**Recent events:**")
        for evt in reversed(list(stats["event_log"])[-10:]):
            st.caption(evt)

    st.markdown("#### 🚨 Alert")
    alert_ph = st.empty()
    st.markdown("#### 📝 Alerts log")
    alert_log_ph = st.empty()
    st.markdown("#### 📈 EAR over time")
    ear_chart_ph = st.empty()
    st.markdown("#### 📈 Yaw over time")
    yaw_chart_ph = st.empty()

if start_btn:
    st.session_state.running       = True
    st.session_state.start_time    = time.time()
    st.session_state.blink_count   = 0
    st.session_state.drowsy_events = 0
    st.session_state.look_events   = 0
    st.session_state.alert_log     = []
    st.session_state.ear_history   = deque(maxlen=120)
    st.session_state.yaw_history   = deque(maxlen=120)
    st.session_state.burnout       = BurnoutEngine()
    st.session_state.burnout_score = 0.0
    st.session_state.on_break      = False

if stop_btn:
    st.session_state.running = False

# ─────────────────────────────────────────────
# Camera loop
# ─────────────────────────────────────────────
if st.session_state.running:
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        st.error("❌ Cannot open webcam. Make sure it's not used by another app.")
        st.session_state.running = False
    else:
        closed_frames  = 0
        look_frames    = 0
        ear_buf        = deque(maxlen=3)
        blink_was_open = True
        drowsy_active  = False
        look_active    = False
        frame_count    = 0
        burnout        = st.session_state.burnout

        with mp_face_mesh.FaceMesh(
            max_num_faces        = 1,
            refine_landmarks     = True,
            min_detection_confidence = 0.6,
            min_tracking_confidence  = 0.6,
        ) as face_mesh:

            while st.session_state.running:
                ret, frame = cap.read()
                if not ret:
                    break

                if mirror:
                    frame = cv2.flip(frame, 1)

                rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = face_mesh.process(rgb)

                ear   = 0.0
                yaw   = 0.0
                pitch = 0.0
                roll  = 0.0
                status = "NO FACE"

                if result.multi_face_landmarks:
                    lm = result.multi_face_landmarks[0].landmark

                    if show_mesh:
                        mp_drawing.draw_landmarks(
                            image=rgb,
                            landmark_list=result.multi_face_landmarks[0],
                            connections=mp_face_mesh.FACEMESH_TESSELATION,
                            landmark_drawing_spec=None,
                            connection_drawing_spec=mp_styles.get_default_face_mesh_tesselation_style(),
                        )
                    if show_iris:
                        mp_drawing.draw_landmarks(
                            image=rgb,
                            landmark_list=result.multi_face_landmarks[0],
                            connections=mp_face_mesh.FACEMESH_IRISES,
                            landmark_drawing_spec=None,
                            connection_drawing_spec=mp_styles.get_default_face_mesh_iris_connections_style(),
                        )

                    # EAR
                    ear = (compute_ear(lm, LEFT_EYE) + compute_ear(lm, RIGHT_EYE)) / 2
                    ear_buf.append(ear)
                    ear = sum(ear_buf) / len(ear_buf)

                    # Blink
                    if ear < ear_thresh:
                        closed_frames  += 1
                        blink_was_open  = False
                    else:
                        if not blink_was_open and 1 < closed_frames <= drowsy_f:
                            st.session_state.blink_count += 1
                        closed_frames  = 0
                        blink_was_open = True

                    # Drowsy
                    if closed_frames >= drowsy_f:
                        if not drowsy_active:
                            drowsy_active = True
                            st.session_state.drowsy_events += 1
                            burnout.log_drowsy_event()          # ← feed into BurnoutEngine
                            ts = time.strftime('%H:%M:%S')
                            st.session_state.alert_log.append({"Time": ts, "Type": "Drowsy"})
                            st.session_state.alert_log = st.session_state.alert_log[-50:]
                            alert_ph.error(f"😴 **Drowsy alert** — {ts}")
                    else:
                        drowsy_active = False

                    # Head pose
                    yaw, pitch, roll = compute_head_pose(lm)

                    if abs(yaw) > yaw_thresh or pitch < -pitch_thresh:
                        look_frames += 1
                        if look_frames >= 20 and not look_active:
                            look_active = True
                            st.session_state.look_events += 1
                            d = "sideways" if abs(yaw) > yaw_thresh else "down"
                            ts = time.strftime('%H:%M:%S')
                            st.session_state.alert_log.append({"Time": ts, "Type": f"Head turned {d}"})
                            st.session_state.alert_log = st.session_state.alert_log[-50:]
                            alert_ph.warning(f"↔️ **Head turned {d}** — {ts}")
                    else:
                        look_frames = 0
                        look_active = False

                    # Status
                    if closed_frames >= drowsy_f:
                        status = "DROWSY"
                    elif abs(yaw) > yaw_thresh or pitch < -pitch_thresh:
                        status = "LOOK AWAY"
                    else:
                        status = "FOCUSED"

                # ── Burnout engine update ─────────────────────────────────────
                result        = burnout.compute()
                burnout_score = result["total"]
                b_stats       = burnout.get_stats()
                label, _      = BurnoutEngine.score_label(burnout_score)
                st.session_state.burnout_score = burnout_score

                # ── Break notification ────────────────────────────────────────
                if burnout.should_notify_break():
                    ts = time.strftime('%H:%M:%S')
                    st.session_state.alert_log.append({"Time": ts, "Type": "⚠️ Burnout — Take a Break!"})
                    alert_ph.warning(
                        f"🔥 **Burnout detected!** ({burnout_score:.0f}/100) — "
                        f"Please take a **15-minute break** ☕"
                    )

                # ── Break timer UI ────────────────────────────────────────────
                if burnout.on_break:
                    remaining = burnout.break_time_remaining()
                    rm, rs    = divmod(remaining, 60)
                    burnout_panel_ph.success(
                        f"☕ **ON BREAK** — {rm:02d}:{rs:02d} remaining\n\nStep away, stretch, hydrate!"
                    )
                    if remaining == 0:
                        burnout.end_break()
                        st.session_state.on_break = False
                else:
                    sigs = b_stats["signals"]
                    burnout_panel_ph.markdown(
                        f"**Score: {burnout_score:.0f}/100** — {label}  \n"
                        f"🔥 Fatigue pool: `{b_stats['fatigue_pool']:.1f}/65`  \n"
                        f"🛏️ Floor (context): `{b_stats['floor']:.1f}/35`  \n"
                        f"─────────────  \n"
                        f"Self report: `{sigs.get('self_report',0):.1f}/20`  \n"
                        f"Plan decay: `{sigs.get('plan_decay',0):.1f}/8`  \n"
                        f"Schedule strain: `{sigs.get('schedule_strain',0):.1f}/7`  \n"
                        f"─────────────  \n"
                        f"Drowsy events: `{b_stats.get('drowsy_total',0)}`  \n"
                        f"Explain clicks: `{b_stats.get('explain_clicks',0)}`  \n"
                        f"Breaks taken: `{b_stats['break_count']}`"
                    )

                # Sidebar burnout widgets
                burnout_score_ph.metric("🔥 Burnout Score", f"{burnout_score:.0f}/100")
                burnout_bar_ph.progress(int(burnout_score))
                burnout_label_ph.markdown(f"**{label}**")

                # Draw HUD on BGR frame
                frame = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
                frame = draw_hud(frame, ear, yaw, pitch, roll,
                                 closed_frames, st.session_state.blink_count,
                                 status, ear_thresh, drowsy_f)

                # Display
                cam_ph.image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
                             channels="RGB", use_container_width=True)

                # Sidebar stats
                elapsed = int(time.time() - (st.session_state.start_time or time.time()))
                stat_blinks.metric("👁️ Blinks",          st.session_state.blink_count)
                stat_drowsy.metric("😴 Drowsy Events",    st.session_state.drowsy_events)
                stat_look.metric("↔️ Look Away Events",   st.session_state.look_events)
                stat_alerts.metric("🚨 Alerts",           len(st.session_state.alert_log))
                stat_time.metric("⏱️ Session",            f"{elapsed}s")
                stat_blink_rate.metric("📝 Questions",    b_stats["questions_seen"])
                stat_breaks.metric("☕ Breaks Taken",     b_stats["break_count"])

                if st.session_state.alert_log:
                    alert_df = pd.DataFrame(st.session_state.alert_log[::-1])
                    alert_log_ph.dataframe(alert_df, height=160, use_container_width=True)
                else:
                    alert_log_ph.info("No alerts yet")

                # Charts (every 10 frames)
                frame_count += 1
                st.session_state.ear_history.append(round(ear, 3))
                st.session_state.yaw_history.append(round(yaw, 1))

                if frame_count % 10 == 0:
                    ear_chart_ph.line_chart(
                        pd.DataFrame({"EAR": list(st.session_state.ear_history)}),
                        height=140,
                    )
                    yaw_chart_ph.line_chart(
                        pd.DataFrame({"Yaw°": list(st.session_state.yaw_history)}),
                        height=140,
                    )

        cap.release()

else:
    cam_ph.info("👆 Click **Start Camera** to begin")
    elapsed = int(time.time() - st.session_state.start_time) if st.session_state.start_time else 0
    stat_blinks.metric("👁️ Blinks",         st.session_state.blink_count)
    stat_drowsy.metric("😴 Drowsy Events",   st.session_state.drowsy_events)
    stat_look.metric("↔️ Look Away Events",  st.session_state.look_events)
    stat_alerts.metric("🚨 Alerts",          len(st.session_state.alert_log))
    stat_time.metric("⏱️ Session",           f"{elapsed}s")

    if st.session_state.alert_log:
        alert_df = pd.DataFrame(st.session_state.alert_log[::-1])
        alert_log_ph.dataframe(alert_df, height=160, use_container_width=True)
    else:
        alert_log_ph.info("No alerts yet")

    if st.session_state.ear_history:
        ear_chart_ph.line_chart(
            pd.DataFrame({"EAR": list(st.session_state.ear_history)}),
            height=140,
        )
    if st.session_state.yaw_history:
        yaw_chart_ph.line_chart(
            pd.DataFrame({"Yaw°": list(st.session_state.yaw_history)}),
            height=140,
        )