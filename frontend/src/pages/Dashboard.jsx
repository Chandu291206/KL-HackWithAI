import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard } from "../api/user";
import { generateExamTest } from "../api/tests";
import TextType from "./TextType";
import {
  FiBell,
  FiPlayCircle,
  FiChevronRight,
  FiCoffee,
} from "react-icons/fi";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startingTest, setStartingTest] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const dbData = await getDashboard();
      setData(dbData);
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExamination = async () => {
    try {
      setStartingTest(true);
      const testData = await generateExamTest();
      sessionStorage.setItem(
        "currentTest",
        JSON.stringify({
          ...testData,
          testId: testData.test_id,
          testName: testData.test_name,
        })
      );
      navigate("/test");
    } catch (err) {
      console.error("Failed to start examination", err);
      alert("Failed to start examination. Please try again.");
    } finally {
      setStartingTest(false);
    }
  };

  const handleTakeBreak = () => {
    navigate("/break-timer", {
      state: {
        returnTo: "/dashboard",
        durationSeconds: 5 * 60,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-white">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-10">Error loading dashboard</div>;
  }

  // Find weakest topic
  let weakestTopic = null;
  ["Physics", "Chemistry", "Math", "Biology"].forEach((subj) => {
    if (data.topic_health[subj]) {
      const weak = data.topic_health[subj].find((t) => t.type === "weak");
      if (weak && (!weakestTopic || weak.score < weakestTopic.score)) {
        weakestTopic = { ...weak, subject: subj };
      }
    }
  });

  // Display 3 topics randomly
  const allTopics = [];
  ["Physics", "Chemistry", "Math", "Biology"].forEach((subj) => {
    if (data.topic_health[subj]) {
      allTopics.push(
        ...data.topic_health[subj].map((t) => ({ ...t, subject: subj }))
      );
    }
  });

  const displayTopics = allTopics
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-white text-slate-700">
      <div className="p-8 pb-24 max-w-7xl mx-auto space-y-10">

        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold text-slate-900">
              Overview
            </h2>

            {/* TEXT TYPE BELOW OVERVIEW */}
            <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              <TextType
              className="text-4xl font-extrabold"
                texts={["Welcome back!!", "Let’s keep going!"]}
                typingSpeed={75}
                pauseDuration={1500}
                deletingSpeed={50}
                showCursor
                cursorCharacter="_"
                variableSpeedEnabled={false}
                cursorBlinkDuration={0.5}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-white/60 shadow-md px-5 py-2 rounded-full">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Daily Target
              </span>
              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 w-[60%] rounded-full" />
              </div>
              <span className="text-blue-600 font-bold text-sm">60%</span>
            </div>

            <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl border border-white/60 shadow-md px-4 py-2 rounded-2xl">
              🔥
              <span className="font-semibold">
                {data.streak?.current || 0} Day Streak
              </span>
            </div>

            <FiBell className="text-xl text-slate-500 cursor-pointer hover:text-blue-600" />
          </div>
        </div>

        {/* BANNER */}
        <div className="relative overflow-hidden rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/60 shadow-xl p-10">
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-400/10 blur-3xl rounded-full" />

          <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-bold uppercase tracking-widest mb-4">
                Performance Insight
              </div>

              <h1 className="text-4xl font-bold text-slate-900">
                {weakestTopic ? (
                  <>
                    Focus on{" "}
                    <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                      {weakestTopic.name}
                    </span>
                  </>
                ) : (
                  "Great Progress!"
                )}
              </h1>

              <p className="text-slate-600 mt-4 max-w-xl">
                {weakestTopic
                  ? `Your performance in ${weakestTopic.subject} needs improvement. Let’s strengthen it today.`
                  : "You're performing consistently across subjects. Keep it up!"}
              </p>
            </div>

            <button
              onClick={() => navigate("/learn")}
              className="flex items-center gap-2 px-8 h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <FiPlayCircle />
              {weakestTopic ? "Start Review" : "Continue Learning"}
            </button>
          </div>
        </div>

        {/* GRID */}
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">

            {/* TODAY PLAN */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800">
                  Today’s Agenda
                </h3>
                <button
                  onClick={() => navigate("/study-plan")}
                  className="text-blue-600 font-semibold text-sm"
                >
                  Modify
                </button>
              </div>

              <div className="space-y-4">
                {data.today_plan?.tasks?.length > 0 ? (
                  data.today_plan.tasks.map((task, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-5 p-5 rounded-2xl backdrop-blur-xl border border-white shadow-md transition-all
                        ${task.completed ? "bg-gray-50/50 opacity-70" : "bg-white/70 hover:shadow-lg hover:-translate-y-1"}`}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed || false}
                        readOnly
                        className="w-5 h-5 accent-blue-600"
                      />
                      <div className="flex-1">
                        <div className={`font-semibold ${task.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>
                          {task.title || task.topic_name}
                        </div>
                        <div className={`text-sm ${task.completed ? "text-slate-400" : "text-slate-500"}`}>
                          {task.duration_mins} mins
                        </div>
                      </div>
                      <FiChevronRight className={task.completed ? "text-slate-300" : "text-slate-600"} />
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-sm">
                    No tasks for today.
                  </div>
                )}
              </div>
            </div>

            {/* TOPIC HEALTH */}
            <div>
              <h3 className="text-2xl font-bold mb-6">Topic Health</h3>

              <div className="grid sm:grid-cols-3 gap-6">
                {displayTopics.map((topic, i) => {
                  const percent = Math.round(topic.score);
                  const color =
                    topic.type === "strong"
                      ? "from-teal-400 to-teal-500"
                      : topic.type === "weak"
                      ? "from-red-400 to-red-500"
                      : "from-amber-400 to-amber-500";

                  return (
                    <div
                      key={i}
                      className="p-6 rounded-2xl bg-white/70 backdrop-blur-xl border border-white shadow-md hover:shadow-lg transition-all"
                    >
                      <div className="flex justify-between mb-4">
                        <span className="font-semibold">{topic.name}</span>
                        <span className="text-xs px-2 py-1 bg-slate-100 rounded-full uppercase">
                          {topic.type}
                        </span>
                      </div>

                      <div className="text-3xl font-bold">{percent}%</div>

                      <div className="w-full h-2 bg-slate-200 rounded-full mt-3 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${color} rounded-full`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8">
            <div className="p-6 rounded-2xl bg-white/70 backdrop-blur-xl border border-white shadow-md">
              <h3 className="font-bold text-lg mb-2">
                Weekly Mock Test
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Closes Sunday, 11PM
              </p>

              <div className="bg-white/60 rounded-xl p-4 text-sm mb-6">
                <div className="flex justify-between">
                  <span>Questions</span>
                  <span className="font-bold">90</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="font-bold">180 mins</span>
                </div>
              </div>

              <button
                onClick={handleStartExamination}
                disabled={startingTest}
                className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
              >
                {startingTest ? "Starting..." : "Start Examination"}
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg">
              <h3 className="font-bold text-lg mb-2">Recovery Break</h3>
              <p className="text-sm text-blue-50 mb-5">
                Feeling tired? Take a focused 5-minute reset before your next study block.
              </p>
              <button
                onClick={handleTakeBreak}
                className="w-full h-11 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <FiCoffee />
                Start Break Timer
              </button>
            </div>

           
          </div>
        </div>

      </div>
    </div>
  );
}
