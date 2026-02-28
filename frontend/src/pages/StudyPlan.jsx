import { useState, useEffect } from "react";
import {
  generatePlan,
  getActivePlan,
  completeTask,
  checkLLMHealth,
} from "../api/plans";
import { Link } from "react-router-dom";

export default function StudyPlan() {
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [llmStatus, setLlmStatus] = useState("checking");

  useEffect(() => {
    fetchPlan();
    checkLlm();
  }, []);

  const checkLlm = async () => {
    const health = await checkLLMHealth();
    setLlmStatus(health.llm);
  };

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const data = await getActivePlan();
      setPlanData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    try {
      setGenerating(true);
      await generatePlan();
      await fetchPlan();
      await checkLlm();
    } catch (err) {
      console.error(err);
      alert("Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  };

  const handleCompleteTask = async (dayNumber, taskIndex) => {
    await completeTask(dayNumber, taskIndex);
    fetchPlan();
  };

  /* PROGRESS CALCULATION */
  let completedTasks = 0;
  let totalTasks = 0;

  if (planData?.plan_json) {
    planData.plan_json.forEach((d) => {
      (d.tasks || []).forEach((t) => {
        totalTasks++;
        if (t.completed) completedTasks++;
      });
    });
  }

  const progressPercent =
    totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-sky-100 via-indigo-200 to-slate-100 text-slate-800">

      {/* Background Glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-300/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-300/20 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* HEADER */}
        <div className="flex justify-between items-end flex-wrap gap-6 mb-14">

          <div className="space-y-4">

            {/* AI Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-600 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
              ● AI Generated Plan
            </div>

            <h1 className="text-5xl font-serif font-bold tracking-tight">
              7-Day Revision Roadmap
            </h1>

            <p className="text-slate-600 text-lg max-w-xl">
              Personalized focus based on your recent performance.
            </p>
          </div>

          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="flex items-center gap-2 px-8 h-12 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold shadow-lg shadow-sky-500/30 transition-all hover:-translate-y-0.5"
          >
            {generating ? "Generating..." : "Regenerate"}
          </button>
        </div>

        {/* PROGRESS */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">

          <div className="md:col-span-2 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 p-8 shadow-lg">

            <div className="flex justify-between mb-6 items-end">
              <div>
                <h3 className="text-xl font-bold">
                  Weekly Progress
                </h3>
                <p className="text-sm text-slate-500">
                  Consistency builds mastery.
                </p>
              </div>
              <div className="text-4xl font-bold text-sky-600">
                {progressPercent}%
              </div>
            </div>

            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 p-8 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="font-bold mb-3 text-sky-600 uppercase text-xs tracking-wider">
                Critical Focus
              </h3>
              <p className="text-lg font-serif font-bold">
                Strengthen Weak Topics
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Complete daily tasks to improve weak areas.
              </p>
            </div>

            <Link to="/analytics" className="mt-6 text-sky-600 font-semibold text-sm hover:underline">
              View Analytics →
            </Link>
          </div>
        </div>

        {/* DAYS */}
        <div className="space-y-6">
          {loading && (
            <div className="p-16 text-center rounded-2xl bg-white/60 backdrop-blur-xl border border-white shadow-lg">
              Loading Study Plan...
            </div>
          )}

          {!loading &&
            planData?.plan_json?.map((dayObj, index) => (
              <DayCard
                key={index}
                dayObj={dayObj}
                onComplete={handleCompleteTask}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

/* DAY CARD */

function DayCard({ dayObj, onComplete }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white shadow-xl overflow-hidden mb-6 hover:shadow-2xl transition-shadow duration-300">

      <button
        onClick={() => setOpen(!open)}
        className="w-full p-6 flex justify-between items-center bg-white/60 hover:bg-white/90 transition-colors border-b border-transparent hover:border-sky-100"
      >
        <div className="text-left">
          <h3 className="text-xl font-serif font-bold text-indigo-900">
            Day {dayObj.day}
          </h3>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {(dayObj.tasks || []).length} Tasks
          </p>
        </div>

        <div className={`transition-transform duration-300 text-sky-600 ${open ? "rotate-180" : ""}`}>
          ▼
        </div>
      </button>

      {open && (
        <div className="p-6 bg-slate-50/50 space-y-4">

          {dayObj.tasks?.map((task, index) => (
            <div
              key={index}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all flex justify-between items-center group"
            >
              <div>
                <div className="font-bold text-lg text-slate-800 group-hover:text-sky-700 transition-colors">
                  {task.topic_name}
                </div>
                <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-sky-400"></span>
                  {task.duration_mins} mins
                </div>
              </div>

              <button
                onClick={() => onComplete(dayObj.day, index)}
                disabled={task.completed}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all
                  ${task.completed
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : "bg-sky-500 hover:bg-sky-600 hover:-translate-y-0.5 text-white shadow-sm hover:shadow-sky-500/30"
                  }`}
              >
                {task.completed ? "Done ✓" : "Complete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}