import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitTest } from "../api/tests";
import { BurnoutEngine } from "../lib/burnoutEngine";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiCoffee,
  FiVideo,
  FiAlertTriangle,
} from "react-icons/fi";

const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const NOSE_TIP = 1;
const CHIN = 199;
const LEFT_EYE_OUT = 263;
const RIGHT_EYE_OUT = 33;
const FOREHEAD = 10;

const EAR_THRESHOLD = 0.23;
const DROWSY_FRAMES = 15;
const YAW_THRESHOLD = 20;
const PITCH_THRESHOLD = 20;
const LOOK_AWAY_FRAMES = 20;
const FAST_BREAK_THRESHOLD = 20;

const BREAK_TIMER_SECS = 5 * 60;
const SNAPSHOT_KEY = "aiProctoringSnapshot";
const RESUME_FLAG_KEY = "aiProctoringResume";

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function computeEAR(lm, indices) {
  const p = indices.map((idx) => lm[idx]);
  const v1 = dist(p[1], p[5]);
  const v2 = dist(p[2], p[4]);
  const h = dist(p[0], p[3]);
  return h > 1e-6 ? (v1 + v2) / (2 * h) : 0;
}

function computeHeadPose(lm) {
  const nose = lm[NOSE_TIP];
  const chin = lm[CHIN];
  const lEye = lm[LEFT_EYE_OUT];
  const rEye = lm[RIGHT_EYE_OUT];
  const forehead = lm[FOREHEAD];
  const faceW = Math.abs(lEye.x - rEye.x);
  const faceH = Math.abs(chin.y - forehead.y);
  if (faceW < 1e-6 || faceH < 1e-6) return { yaw: 0, pitch: 0, roll: 0 };
  const eyeMidX = (lEye.x + rEye.x) / 2;
  const yaw = ((nose.x - eyeMidX) / faceW) * 90;
  const midY = (forehead.y + chin.y) / 2;
  const pitch = -((nose.y - midY) / faceH) * 90;
  const roll = (Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x) * 180) / Math.PI;
  return { yaw, pitch, roll };
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const found = document.querySelector(`script[src="${src}"]`);
    if (found) {
      if (found.dataset.loaded === "true") {
        resolve();
      } else {
        found.addEventListener("load", () => resolve(), { once: true });
        found.addEventListener("error", () => reject(new Error(src)), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(src));
    document.body.appendChild(script);
  });
}

function waitForVideoReady(video, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!video) {
      reject(new Error("Video element missing"));
      return;
    }

    if (video.readyState >= 2) {
      resolve();
      return;
    }

    let done = false;
    const timeoutId = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("Video stream timed out"));
    }, timeoutMs);

    const onReady = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("playing", onReady);
    };

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("playing", onReady);
  });
}

export default function AIProctoringPage() {
  const navigate = useNavigate();
  const burnoutRef = useRef(new BurnoutEngine());
  const faceMeshRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const processingRef = useRef(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const breakTimeoutRef = useRef(null);
  const breakNavigatingRef = useRef(false);
  const snapshotRef = useRef(null);

  const closedFramesRef = useRef(0);
  const lookFramesRef = useRef(0);
  const blinkOpenRef = useRef(true);
  const drowsyActiveRef = useRef(false);
  const lookActiveRef = useRef(false);

  const [testSession, setTestSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeSpent, setTimeSpent] = useState({});
  const [visitedQs, setVisitedQs] = useState([0]);
  const [submitting, setSubmitting] = useState(false);

  const [status, setStatus] = useState("NO FACE");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraCycle, setCameraCycle] = useState(0);
  const [metrics, setMetrics] = useState({
    ear: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    blinks: 0,
    drowsy: 0,
    lookAway: 0,
    burnout: 0,
    label: "Fresh",
  });
  const [breakNotice, setBreakNotice] = useState("");

  const handleRestartCamera = useCallback(() => {
    setCameraError("");
    setCameraReady(false);
    setStatus("NO FACE");
    closedFramesRef.current = 0;
    lookFramesRef.current = 0;
    blinkOpenRef.current = true;
    drowsyActiveRef.current = false;
    lookActiveRef.current = false;
    setCameraCycle((prev) => prev + 1);
  }, []);

  useEffect(() => {
    snapshotRef.current = {
      testSession,
      currentIndex,
      answers,
      timeLeft,
      timeSpent,
      visitedQs,
    };
  }, [testSession, currentIndex, answers, timeLeft, timeSpent, visitedQs]);

  const startBreakFlow = useCallback(
    (message) => {
      if (breakNavigatingRef.current) return;
      breakNavigatingRef.current = true;
      const snapshot = snapshotRef.current;
      if (snapshot?.testSession) {
        sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
      }
      setBreakNotice(message);
      navigate("/break-timer", {
        state: {
          returnTo: "/ai-proctoring",
          resumeSessionStorageKey: RESUME_FLAG_KEY,
          durationSeconds: BREAK_TIMER_SECS,
        },
      });
    },
    [navigate]
  );

  useEffect(() => {
    const shouldResume = sessionStorage.getItem(RESUME_FLAG_KEY) === "1";
    if (shouldResume) {
      sessionStorage.removeItem(RESUME_FLAG_KEY);
      try {
        const restored = JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY) || "{}");
        if (restored?.testSession) {
          setTestSession(restored.testSession);
          setCurrentIndex(restored.currentIndex || 0);
          setAnswers(restored.answers || {});
          setTimeLeft(restored.timeLeft || 0);
          setTimeSpent(restored.timeSpent || {});
          setVisitedQs(restored.visitedQs?.length ? restored.visitedQs : [0]);
          return;
        }
      } catch (err) {
        console.error("Failed to resume proctoring session", err);
      }
    }

    const raw = sessionStorage.getItem("currentTest");
    if (!raw) {
      navigate("/learn");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setTestSession(parsed);
      setTimeLeft(parsed.questions.length * 120);
      setVisitedQs([0]);
    } catch (err) {
      navigate("/learn");
    }
  }, [navigate]);

  useEffect(() => {
    setVisitedQs((prev) => (prev.includes(currentIndex) ? prev : [...prev, currentIndex]));
  }, [currentIndex]);

  useEffect(() => {
    if (!testSession || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      const qId = testSession.questions[currentIndex]?.id;
      if (qId) {
        setTimeSpent((prev) => ({ ...prev, [qId]: (prev[qId] || 0) + 1 }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [testSession, currentIndex, timeLeft]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setCameraReady(false);
      setCameraError("");
      processingRef.current = false;
      closedFramesRef.current = 0;
      lookFramesRef.current = 0;
      blinkOpenRef.current = true;
      drowsyActiveRef.current = false;
      lookActiveRef.current = false;
      setStatus("NO FACE");

      try {
        await Promise.all([
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"),
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"),
        ]);
        if (cancelled || !videoRef.current) return;
        if (!window.FaceMesh) {
          throw new Error("FaceMesh script loaded but API is unavailable");
        }

        const mesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        mesh.onResults((results) => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!canvas || !ctx) return;

          canvas.width = results.image.width;
          canvas.height = results.image.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

          let localStatus = "NO FACE";
          let localEAR = 0;
          let localYaw = 0;
          let localPitch = 0;
          let localRoll = 0;

          if (results.multiFaceLandmarks?.length) {
            const lm = results.multiFaceLandmarks[0];
            localEAR = (computeEAR(lm, LEFT_EYE) + computeEAR(lm, RIGHT_EYE)) / 2;
            const pose = computeHeadPose(lm);
            localYaw = pose.yaw;
            localPitch = pose.pitch;
            localRoll = pose.roll;

            if (localEAR < EAR_THRESHOLD) {
              closedFramesRef.current += 1;
              blinkOpenRef.current = false;
            } else {
              if (!blinkOpenRef.current && closedFramesRef.current > 1 && closedFramesRef.current <= DROWSY_FRAMES) {
                setMetrics((prev) => ({ ...prev, blinks: prev.blinks + 1 }));
              }
              closedFramesRef.current = 0;
              blinkOpenRef.current = true;
            }

            if (closedFramesRef.current >= DROWSY_FRAMES) {
              localStatus = "DROWSY";
              if (!drowsyActiveRef.current) {
                drowsyActiveRef.current = true;
                burnoutRef.current.log_drowsy_event();
                setMetrics((prev) => ({ ...prev, drowsy: prev.drowsy + 1 }));
              }
            } else {
              drowsyActiveRef.current = false;
            }

            if (Math.abs(localYaw) > YAW_THRESHOLD || localPitch < -PITCH_THRESHOLD) {
              lookFramesRef.current += 1;
              if (lookFramesRef.current >= LOOK_AWAY_FRAMES && !lookActiveRef.current) {
                lookActiveRef.current = true;
                burnoutRef.current.log_look_away_event();
                setMetrics((prev) => ({ ...prev, lookAway: prev.lookAway + 1 }));
              }
            } else {
              lookFramesRef.current = 0;
              lookActiveRef.current = false;
            }

            if (localStatus !== "DROWSY") {
              localStatus =
                Math.abs(localYaw) > YAW_THRESHOLD || localPitch < -PITCH_THRESHOLD
                  ? "LOOK AWAY"
                  : "FOCUSED";
            }
          }

          const score = burnoutRef.current.compute().total;
          const label = BurnoutEngine.score_label(score);
          setStatus(localStatus);
          setMetrics((prev) => ({
            ...prev,
            ear: localEAR,
            yaw: localYaw,
            pitch: localPitch,
            roll: localRoll,
            burnout: score,
            label,
          }));

          if (
            !breakNavigatingRef.current &&
            !burnoutRef.current.on_break &&
            !burnoutRef.current.break_notified &&
            score >= FAST_BREAK_THRESHOLD
          ) {
            burnoutRef.current.break_notified = true;
            const message = `Burnout score ${Math.round(score)}/100 detected. Starting break timer...`;
            setBreakNotice(message);
            if (!breakTimeoutRef.current) {
              breakTimeoutRef.current = setTimeout(() => {
                breakTimeoutRef.current = null;
                startBreakFlow(message);
              }, 500);
            }
          }
        });

        faceMeshRef.current = mesh;

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("getUserMedia not supported");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (err) {
          // Some browsers reject play() even when stream exists; readiness check below handles this.
        }
        await waitForVideoReady(videoRef.current, 6000);

        const processFrame = async () => {
          if (cancelled) return;

          if (
            faceMeshRef.current &&
            videoRef.current &&
            videoRef.current.readyState >= 2 &&
            !processingRef.current
          ) {
            processingRef.current = true;
            try {
              await Promise.race([
                faceMeshRef.current.send({ image: videoRef.current }),
                new Promise((_, reject) => {
                  setTimeout(() => reject(new Error("FaceMesh frame timeout")), 2000);
                }),
              ]);
            } catch (err) {
              if (!cancelled) {
                setCameraError("Webcam processing interrupted. Click Restart Camera.");
              }
            } finally {
              processingRef.current = false;
            }
          }

          rafRef.current = requestAnimationFrame(processFrame);
        };

        rafRef.current = requestAnimationFrame(processFrame);
        if (!cancelled) setCameraReady(true);
      } catch (err) {
        console.error("AI proctoring webcam init failed:", err);
        if (!cancelled) {
          setCameraReady(false);
          setCameraError("Unable to access webcam for AI proctoring.");
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      if (breakTimeoutRef.current) {
        clearTimeout(breakTimeoutRef.current);
      }
      breakTimeoutRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      processingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (faceMeshRef.current?.close) {
        faceMeshRef.current.close();
      }
      faceMeshRef.current = null;
    };
  }, [startBreakFlow, cameraCycle]);

  const handleOption = (qId, choice) => {
    setAnswers((prev) => {
      if (prev[qId] && prev[qId] !== choice) burnoutRef.current.log_answer_change();
      return { ...prev, [qId]: choice };
    });
  };

  const handleSubmit = async () => {
    if (!testSession || submitting) return;
    const payload = testSession.questions.map((q) => ({
      question_id: q.id,
      user_answer: answers[q.id] || "",
      time_spent_seconds: timeSpent[q.id] || 0,
    }));
    try {
      setSubmitting(true);
      const result = await submitTest(testSession.testId, payload);
      sessionStorage.setItem("testResult", JSON.stringify({ ...result, questions: testSession.questions }));
      sessionStorage.removeItem("currentTest");
      sessionStorage.removeItem(SNAPSHOT_KEY);
      navigate("/results");
    } catch (err) {
      alert("Failed to submit test. Please try again.");
      setSubmitting(false);
    }
  };

  if (!testSession) {
    return <div className="min-h-screen flex items-center justify-center">Loading proctored test...</div>;
  }

  const questions = testSession.questions;
  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-100 px-4 md:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="p-2 hover:bg-slate-100 rounded-full">
            <FiArrowLeft />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-bold">AI Proctoring Test</h1>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Live monitoring active</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
            <div className="text-[10px] uppercase tracking-widest text-blue-500 font-bold">Time Left</div>
            <div className="font-mono font-bold flex items-center gap-2">
              <FiClock />
              {formatTime(timeLeft)}
            </div>
          </div>
          <button
            onClick={() => startBreakFlow("Manual break requested.")}
            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500"
          >
            <FiCoffee />
            Take Break
          </button>
        </div>
      </header>

      {breakNotice && (
        <div className="mx-4 md:mx-8 mt-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-2">
          <FiAlertTriangle />
          <span className="text-sm">{breakNotice}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 p-4 md:p-6 flex gap-6">
        <aside className="w-full max-w-[360px] bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <FiVideo />
              Webcam Proctoring
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{status}</span>
              <button
                onClick={handleRestartCamera}
                className="text-[10px] px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Restart Camera
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[4/3]">
            <video
              ref={videoRef}
              className="absolute w-px h-px opacity-0 pointer-events-none"
              autoPlay
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-slate-900/70 text-slate-200 flex items-center justify-center text-sm">
                Initializing camera...
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 bg-red-900/70 text-red-100 flex items-center justify-center text-sm px-4 text-center">
                {cameraError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="EAR" value={metrics.ear.toFixed(3)} />
            <Stat label="Yaw" value={metrics.yaw.toFixed(1)} />
            <Stat label="Pitch" value={metrics.pitch.toFixed(1)} />
            <Stat label="Roll" value={metrics.roll.toFixed(1)} />
            <Stat label="Blinks" value={metrics.blinks} />
            <Stat label="Drowsy" value={metrics.drowsy} />
            <Stat label="Look Away" value={metrics.lookAway} />
            <Stat label="Burnout" value={`${Math.round(metrics.burnout)}/100`} />
          </div>
        </aside>

        <main className="flex-1 min-h-0 bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-extrabold">Question {currentIndex + 1}</h2>
            <p className="mt-4 text-slate-700 leading-relaxed">{currentQ.question_text}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
            {[
              { letter: "A", value: currentQ.option_a },
              { letter: "B", value: currentQ.option_b },
              { letter: "C", value: currentQ.option_c },
              { letter: "D", value: currentQ.option_d },
            ].map((opt) => (
              <button
                key={opt.letter}
                onClick={() => handleOption(currentQ.id, opt.letter)}
                className={`text-left rounded-2xl border px-4 py-4 transition-all ${
                  answers[currentQ.id] === opt.letter
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="font-bold text-sm text-slate-500">{opt.letter}</div>
                <div className="mt-1 text-slate-800">{opt.value}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {questions.map((q, idx) => {
              const answered = !!answers[q.id];
              const visited = visitedQs.includes(idx);
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold ${
                    currentIndex === idx
                      ? "bg-blue-600 text-white"
                      : answered
                      ? "bg-blue-50 text-blue-700"
                      : visited
                      ? "bg-red-50 text-red-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between items-center">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="h-11 px-5 rounded-xl border border-slate-200 disabled:opacity-50 flex items-center gap-2"
            >
              <FiArrowLeft />
              Previous
            </button>
            {currentIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="h-11 px-6 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                <FiCheckCircle />
                {submitting ? "Submitting..." : "Submit Test"}
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="h-11 px-6 rounded-xl bg-blue-600 text-white font-semibold flex items-center gap-2"
              >
                Next
                <FiArrowRight />
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{label}</div>
      <div className="text-sm font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
