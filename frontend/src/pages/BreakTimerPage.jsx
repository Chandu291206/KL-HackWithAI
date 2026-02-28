import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheckCircle, FiDroplet, FiWind, FiActivity } from "react-icons/fi";

function formatClock(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function BreakTimerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const doneRef = useRef(false);

  const returnTo = location.state?.returnTo || "/dashboard";
  const resumeSessionStorageKey = location.state?.resumeSessionStorageKey || null;
  const initialDuration = Number(location.state?.durationSeconds) || 5 * 60;

  const [totalDuration, setTotalDuration] = useState(initialDuration);
  const [secondsLeft, setSecondsLeft] = useState(initialDuration);

  const completeBreak = useCallback(() => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;

    if (resumeSessionStorageKey) {
      sessionStorage.setItem(resumeSessionStorageKey, "1");
    }

    navigate(returnTo, { replace: true });
  }, [navigate, returnTo, resumeSessionStorageKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      completeBreak();
    }
  }, [secondsLeft, completeBreak]);

  const progress = useMemo(() => {
    if (totalDuration <= 0) return 0;
    return (totalDuration - secondsLeft) / totalDuration;
  }, [secondsLeft, totalDuration]);

  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const extendOneMinute = () => {
    setSecondsLeft((prev) => prev + 60);
    setTotalDuration((prev) => prev + 60);
  };

  return (
    <div className="min-h-screen bg-[#eaf3fb] text-[#0f172a] flex flex-col">
      <div className="max-w-6xl mx-auto w-full px-6 py-8">
        <div className="flex justify-end">
          <div className="bg-white/70 px-5 py-2 rounded-full text-sm font-semibold text-slate-600 border border-white">
            Focus Mode Active
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center px-6 pb-10">
        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-center mt-4">
          Take a Deep Breath
        </h1>
        <p className="text-center text-slate-600 text-xl md:text-2xl mt-5 max-w-3xl leading-relaxed">
          Your rest period is active. Use this time to recharge and stay away from
          digital distractions.
        </p>

        <div className="mt-12 bg-white/55 backdrop-blur-xl border border-white/70 rounded-[2.5rem] w-full max-w-xl px-10 py-12 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex justify-center">
            <div className="relative w-[280px] h-[280px]">
              <svg viewBox="0 0 280 280" className="w-full h-full -rotate-90">
                <circle
                  cx="140"
                  cy="140"
                  r={radius}
                  fill="none"
                  stroke="#dbeafe"
                  strokeWidth="10"
                />
                <circle
                  cx="140"
                  cy="140"
                  r={radius}
                  fill="none"
                  stroke="#1d74d8"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-[stroke-dashoffset] duration-700 ease-linear"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-6xl md:text-7xl font-extrabold tracking-tight">
                  {formatClock(secondsLeft)}
                </div>
                <span className="text-xs uppercase tracking-[0.3em] font-bold text-slate-500 mt-2">
                  Remaining
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={completeBreak}
            className="mt-8 w-full h-14 rounded-full bg-[#1d74d8] hover:bg-[#1665c1] transition-colors text-white font-bold text-2xl shadow-[0_10px_24px_rgba(29,116,216,0.3)] flex items-center justify-center gap-3"
          >
            <FiCheckCircle />
            Complete Session
          </button>

          <button
            onClick={extendOneMinute}
            className="mt-5 w-full h-12 rounded-full bg-white hover:bg-slate-50 text-slate-600 font-medium border border-slate-100 transition-colors"
          >
            Extend by 1 minute
          </button>
        </div>

        <div className="mt-14 flex items-center gap-12 text-slate-500">
          <div className="flex flex-col items-center gap-2">
            <FiWind className="text-2xl" />
            <span className="text-xs uppercase font-bold tracking-widest">Breathe</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <FiDroplet className="text-2xl" />
            <span className="text-xs uppercase font-bold tracking-widest">Hydrate</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <FiActivity className="text-2xl" />
            <span className="text-xs uppercase font-bold tracking-widest">Stretch</span>
          </div>
        </div>
      </main>
    </div>
  );
}
