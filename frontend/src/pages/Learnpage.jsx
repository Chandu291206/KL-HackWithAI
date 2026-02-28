import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getTopics } from "../api/topics";
import { FiPlay, FiArrowRight, FiSearch, FiBell, FiFolder } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

export default function LearnPage() {
  const { user } = useAuth();
  const [topics, setTopics] = useState(null);
  const [activeTab, setActiveTab] = useState("Physics");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const data = await getTopics();
      setTopics(data);
    } catch (err) {
      console.error("Failed to load topics", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!topics) return <div className="p-10">Error loading topics</div>;

  const currentTabTopics = (topics[activeTab] || []).filter(
    (topic) => !(activeTab === "Math" && topic.name.toLowerCase() === "probability")
  );

  let recommended = null;
  if (currentTabTopics.length > 0) {
    recommended =
      currentTabTopics.find(t => t.user_score > 0 && t.user_score < 70)
      || currentTabTopics[0];
  }

  const getStatus = (score) => {
    if (score === 0) return { label: "Not Started", color: "gray" };
    if (score < 40) return { label: "Needs Focus", color: "red" };
    if (score < 70) return { label: "In Progress", color: "yellow" };
    return { label: "Strong", color: "blue" };
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 md:px-10 md:py-8 font-sans">

      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white rounded-[1.5rem] p-4 md:p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] border border-slate-100 mb-10">
        <h1 className="text-2xl font-extrabold text-[#111827] mb-4 md:mb-0">
          Subject Library
        </h1>
        <div className="flex items-center gap-4">
          {/* <div className="relative w-full md:w-80">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search topics..."
              className="w-full bg-[#f8fafc] border border-slate-100 rounded-2xl pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 outline-none placeholder:text-slate-400 transition-all font-medium"
            />
          </div> */}
          <button className="relative flex-shrink-0 p-3 bg-[#f8fafc] border border-slate-100 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
            <FiBell />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-4">
        <div>
          <h2 className="text-[2.2rem] leading-tight font-extrabold text-[#0f172a] mb-2 tracking-tight">
            Let the learning begin, {user?.name}
          </h2>
          <p className="text-[#64748b] text-[1.1rem]">
            Your academic journey continues. You have <span className="text-[#3b82f6] font-semibold">{currentTabTopics.length} topics</span> pending in {activeTab === "Math" ? "Mathematics" : activeTab}.
          </p>
        </div>
        <div className="flex bg-[#f1f5f9] p-1.5 rounded-full border border-slate-200/50 mb-1">
          <button className="px-6 py-2 bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] rounded-full text-sm font-semibold text-[#334155] transition-all">Topics</button>
          <button className="px-6 py-2 text-[#64748b] hover:text-[#334155] text-sm font-medium rounded-full transition-colors">Saved</button>
          <button className="px-6 py-2 text-[#64748b] hover:text-[#334155] text-sm font-medium rounded-full transition-colors">History</button>
        </div>
      </div>

      {/* Subject Tabs */}
      <div className="flex flex-wrap gap-4 pb-2 mb-8 items-center border-b-0">
        {["Physics", "Chemistry", "Mathematics", "Biology"]
          .filter(tab => {
            if (user?.exam_type === "JEE" && tab === "Biology") return false;
            if (user?.exam_type === "NEET" && tab === "Mathematics") return false;
            return true;
          })
          .map(tab => {
            const mappedTab = tab === "Mathematics" ? "Math" : tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(mappedTab)}
                className={`px-7 py-2.5 rounded-full text-[15px] font-semibold transition-all ${activeTab === mappedTab
                  ? "bg-[#eff6ff] text-[#3b82f6] shadow-sm ring-1 ring-[#bfdbfe]"
                  : "text-[#64748b] hover:text-[#334155] bg-transparent"
                  }`}
              >
                {tab}
              </button>
            )
          })}
      </div>

      {/* Recommended Hero */}
      {recommended && (
        <div className="relative rounded-[2rem] p-8 md:p-12 bg-gradient-to-br from-[#e2e8f0]/40 via-[#f8fafc]/60 to-[#f1f5f9]/50 backdrop-blur-md border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mb-12">
          {/* Glassy light sweep */}
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/40 to-transparent transform -skew-x-12 translate-x-1/4 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="max-w-xl">
              <div className="flex items-center gap-3 mb-5">
                <span className="px-3 py-1 bg-[#eff6ff] text-[#2563eb] text-[10px] sm:text-xs font-extrabold uppercase tracking-widest rounded-md">
                  RECOMMENDED STUDY
                </span>
                <span className="flex items-center gap-2 text-[#64748b] text-sm font-semibold">
                  <FiFolder className="text-[#94a3b8]" />
                  Mechanics
                </span>
              </div>

              <h2 className="text-[2.5rem] leading-tight font-extrabold text-[#0f172a] mb-4 tracking-tight">
                {recommended.name}
              </h2>

              <p className="text-[#475569] text-lg font-medium leading-relaxed max-w-lg">
                Continue your streak with advanced projectile motion problems. Mastery is within reach.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center bg-[#f8fafc]/90 backdrop-blur-md border border-white/80 rounded-[1.5rem] p-5 sm:p-6 shadow-[0_4px_25px_-5px_rgb(0,0,0,0.05)] min-w-max gap-6 sm:gap-8">
              <div className="text-center sm:text-left sm:pl-2">
                <div className="text-[2.5rem] leading-none font-extrabold text-[#0284c7] tracking-tight">
                  {Math.round(recommended.user_score)}<span className="text-[1.5rem] font-bold ml-1">%</span>
                </div>
                <div className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest mt-2 hidden sm:block leading-tight">
                  MASTERY<br />LEVEL
                </div>
                <div className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest mt-2 sm:hidden leading-tight">
                  MASTERY LEVEL
                </div>
              </div>

              <button
                onClick={() => navigate(`/topic/${recommended.id}`)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white font-semibold flex items-center justify-center gap-3 transition-all shadow-md active:scale-95"
              >
                Continue
                <FiArrowRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topics Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {currentTabTopics.map(topic => {
          const status = getStatus(topic.user_score);
          return (
            <TopicCard
              key={topic.id}
              topicId={topic.id}
              title={topic.name}
              subject={activeTab}
              percent={Math.round(topic.user_score)}
              status={status.label}
              color={status.color}
            />
          );
        })}

        {currentTabTopics.length === 0 && (
          <div className="col-span-3 text-center p-12 text-[#64748b] bg-white/50 backdrop-blur-sm border border-dashed border-[#cbd5e1] rounded-2xl font-medium">
            No topics available for {activeTab}
          </div>
        )}
      </div>

    </div>
  );
}

/* Topic Card */

function TopicCard({
  topicId,
  title,
  subject,
  percent,
  status,
  color
}) {
  const navigate = useNavigate();

  const progressColors = {
    blue: "from-[#3b82f6] to-[#06b6d4]",
    red: "from-[#ef4444] to-[#f97316]",
    yellow: "from-[#fbbf24] to-[#facc15]",
    gray: "from-[#cbd5e1] to-[#94a3b8]"
  };

  const iconBgColors = {
    blue: "bg-[#eff6ff] text-[#3b82f6]",
    red: "bg-[#fef2f2] text-[#ef4444]",
    yellow: "bg-[#fffbeb] text-[#f59e0b]",
    gray: "bg-[#f8fafc] text-[#64748b]"
  };

  return (
    <div className="p-7 rounded-[1.5rem] bg-white/80 backdrop-blur-xl border border-white shadow-[0_4px_25px_-5px_rgb(0,0,0,0.02)] hover:shadow-lg transition-all flex flex-col group">

      <div className="flex justify-between items-start mb-6">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBgColors[color]} shadow-sm`}>
          <FiFolder size={18} />
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
            {percent}<span className="text-lg text-[#475569]">%</span>
          </div>
        </div>
      </div>

      <div className="mb-6 flex-1">
        <h3 className="text-[1.3rem] font-bold text-[#0f172a] mb-1.5 leading-tight group-hover:text-[#2563eb] transition-colors">{title}</h3>
        <p className="text-sm text-[#64748b] font-medium">12 Lessons • {status}</p>
      </div>

      <div className="h-1.5 w-full bg-[#f1f5f9] rounded-full overflow-hidden mb-6">
        <div
          style={{ width: percent + "%" }}
          className={`h-full bg-gradient-to-r ${progressColors[color]} rounded-full transition-all duration-1000 ease-out`}
        />
      </div>

      <button
        onClick={() => navigate(`/topic/${topicId}`)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 bg-white hover:bg-[#f8fafc] border border-slate-200 text-[#334155] hover:text-[#0f172a] font-semibold transition-all group-hover:border-slate-300"
      >
        Explore <FiArrowRight className="text-slate-400 group-hover:text-slate-600 transition-colors" />
      </button>

    </div>
  );
}

TopicCard.propTypes = {
  topicId: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  subject: PropTypes.string.isRequired,
  percent: PropTypes.number.isRequired,
  status: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};