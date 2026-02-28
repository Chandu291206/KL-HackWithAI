import PropTypes from "prop-types";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiTarget,
  FiTrendingUp,
  FiArrowRight,
  FiZap,
  FiX
} from "react-icons/fi";

import { getLatestTest, generateQuickTest } from "../api/tests";

export default function TestResults() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Chat Sidebar State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [currentTopicId, setCurrentTopicId] = useState(null);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const chatEndRef = useRef(null);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const data = await getLatestTest();
        setResult(data);
      } catch (e) {
        if (e.response?.status === 404) {
          setError("You haven't completed any tests yet.");
        } else {
          setError("Failed to load test results.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const handleSolveMore = async (topicId) => {
    try {
      setLoading(true);
      const { generateTopicTest } = await import("../api/tests");
      const newTestData = await generateTopicTest(topicId, 7, "mixed");

      const newSession = {
        ...newTestData,
        testId: newTestData.test_id,
        testName: `Topic Drill`
      };

      sessionStorage.setItem('currentTest', JSON.stringify(newSession));
      navigate('/test');
    } catch (err) {
      console.error("Failed to generate topic test", err);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleRetakeTest = async () => {
    try {
      setLoading(true);
      // Generate a new quick test with the same number of questions
      const newTestData = await generateQuickTest(result.total_questions || 50);

      const newSession = {
        ...newTestData,
        testId: newTestData.test_id,
        testName: `Retake Test`
      };

      sessionStorage.setItem('currentTest', JSON.stringify(newSession));
      navigate('/test');
    } catch (err) {
      console.error("Failed to generate retake test", err);
      alert("Something went wrong while generating the test. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLearnMore = (question) => {
    setCurrentTopicId(question.topic_id);
    setCurrentQuestionId(question.id);
    setCurrentQuestion(question);
    setChatMessages([]);
    setChatOpen(true);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading || !currentTopicId) return;

    const newMessages = [...chatMessages, { role: "user", content: chatInput }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/llm/topic-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('educoach_token')}`
        },
        body: JSON.stringify({
          topic_id: currentTopicId,
          question_id: currentQuestionId,
          messages: newMessages
        })
      });

      if (!response.ok) throw new Error("Network error");

      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);

        setChatMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: updated[lastIdx].content + text
          };
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I am offline right now." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading results...
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
        <h2 className="text-2xl font-bold mb-4">{error}</h2>
        <button
          onClick={() => navigate("/test")}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold"
        >
          Start Test
        </button>
      </div>
    );

  const {
    score,
    total_questions,
    time_taken_seconds,
    correct_answers = 0,
    wrong_question_ids = [],
    questions = []
  } = result;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  // Group questions by topic
  const topicStats = {};
  questions.forEach((q) => {
    const topic = q.topic_name || "Unknown";
    if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
    topicStats[topic].total += 1;
    if (!wrong_question_ids.includes(q.id)) {
      topicStats[topic].correct += 1;
    }
  });

  const weakTopics = Object.entries(topicStats)
    .filter(([_, stats]) => stats.total > 0 && stats.correct / stats.total < 0.5)
    .map(([topic]) => topic);

  const strongTopics = Object.entries(topicStats)
    .filter(([_, stats]) => stats.total > 0 && stats.correct / stats.total >= 0.5)
    .map(([topic]) => topic);

  return (
    <>
      {/* Main Page */}
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-slate-100 to-indigo-200 relative overflow-x-hidden">

        {/* Background Blobs */}
        <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-blue-300/20 rounded-full blur-[120px] -translate-x-1/4 -translate-y-1/4 pointer-events-none" />
        <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-indigo-300/20 rounded-full blur-[140px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 py-12 space-y-10">

          {/* Header */}
          <div className="flex justify-between items-end flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                Test Results
              </h1>
              <p className="text-slate-500 mt-2">
                Review your performance and improve strategically.
              </p>
            </div>

            <button
              onClick={handleRetakeTest}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Generating..." : "Retake Test"}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

            <GlassCard
              icon={<FiTarget />}
              label="Score"
              value={`${Number(score).toFixed(1).replace(/\.0$/, "")}%`}
              highlight="text-blue-600"
            />

            <GlassCard
              icon={<FiCheckCircle />}
              label="Correct"
              value={`${correct_answers}/${total_questions}`}
              highlight="text-green-600"
            />

            <GlassCard
              icon={<FiClock />}
              label="Time"
              value={formatTime(time_taken_seconds)}
            />

            <GlassCard
              icon={<FiTrendingUp />}
              label="Wrong"
              value={wrong_question_ids.length}
              highlight="text-red-600"
            />
          </div>

          {/* AI Insight */}
          <div className="rounded-2xl p-8 bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <FiZap />
              </div>
              <h3 className="font-bold text-blue-700 uppercase text-sm tracking-wider">
                AI Performance Insight
              </h3>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              {score >= 70
                ? "Strong Performance!"
                : "Focus needed on weak areas."}
            </h2>

            {/* Topic Analysis Cards */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50/80 border border-red-200 rounded-xl p-4">
                <h4 className="font-bold text-red-700 text-sm uppercase tracking-wider mb-2">Topics to Focus On</h4>
                <div className="flex flex-wrap gap-2">
                  {weakTopics.length > 0 ? weakTopics.map(t => (
                    <span key={t} className="bg-red-100 text-red-700 px-3 py-1 rounded-md text-sm font-semibold">{t}</span>
                  )) : <span className="text-slate-500 text-sm">None! Great job!</span>}
                </div>
              </div>

              <div className="bg-green-50/80 border border-green-200 rounded-xl p-4">
                <h4 className="font-bold text-green-700 text-sm uppercase tracking-wider mb-2">Strong Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {strongTopics.length > 0 ? strongTopics.map(t => (
                    <span key={t} className="bg-green-100 text-green-700 px-3 py-1 rounded-md text-sm font-semibold">{t}</span>
                  )) : <span className="text-slate-500 text-sm">Keep practicing to build strength!</span>}
                </div>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed mb-6">
              <AiSummary testId={result.id || (window.location.hash.split('/').pop() !== "results" ? window.location.hash.split('/').pop() : window.sessionStorage.getItem('testResult') ? JSON.parse(window.sessionStorage.getItem('testResult')).test_id : null)} />
            </p>

            <button
              onClick={() => setActiveTab("analysis")}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 transition"
            >
              Detailed Analysis <FiArrowRight />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 border-b border-white/40 pb-3">
            <button
              onClick={() => setActiveTab("overview")}
              className={`font-semibold ${activeTab === "overview"
                ? "text-blue-600"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`font-semibold ${activeTab === "analysis"
                ? "text-blue-600"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              Question Review
            </button>
          </div>

          {/* Question Review */}
          {activeTab === "analysis" && (
            <div className="space-y-6">
              {wrong_question_ids.length === 0 ? (
                <div className="rounded-2xl p-8 bg-green-100 text-green-700 font-bold text-center">
                  Perfect score! 🎉
                </div>
              ) : (
                questions
                  .filter(q => wrong_question_ids.includes(q.id))
                  .map((q, idx) => (
                    <QuestionReviewCard
                      key={q.id}
                      question={q}
                      index={idx + 1}
                      onSolveMore={handleSolveMore}
                      onLearnMore={handleLearnMore}
                    />
                  ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* TOPIC CHAT SIDEBAR — rendered via Portal to bypass overflow-hidden in Layout */}
      {chatOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end" style={{ fontFamily: 'inherit' }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
            style={{ animation: 'chatFadeIn 0.2s ease-out forwards' }}
            onClick={() => setChatOpen(false)}
          />

          {/* Sidebar Panel */}
          <div
            className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
            style={{ animation: 'chatSlideIn 0.3s ease-out forwards' }}
          >
            <style>{`
              @keyframes chatSlideIn {
                from { transform: translateX(100%); }
                to   { transform: translateX(0); }
              }
              @keyframes chatFadeIn {
                from { opacity: 0; }
                to   { opacity: 1; }
              }
            `}</style>

            {/* Header */}
            <div className="p-5 border-b border-indigo-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50 shrink-0">
              <div className="flex flex-col gap-1">
                <div className="font-extrabold text-purple-700 text-xl flex items-center gap-2">
                  <span className="text-2xl">🤖</span> AI Tutor
                </div>
                {currentQuestion && (
                  <span className="text-xs font-semibold text-indigo-600 bg-white px-2.5 py-1 rounded-full border border-indigo-100 shadow-sm self-start">
                    {currentQuestion.topic_name || "Topic"}
                  </span>
                )}
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-2 hover:bg-white rounded-full text-purple-700 border border-transparent hover:border-indigo-100 shadow-sm transition-colors"
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Context Card */}
            {currentQuestion && (
              <div className="px-5 pt-4 pb-2 shrink-0">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 max-h-20 overflow-y-auto">
                  <span className="font-bold text-slate-900 mr-1">Q:</span>
                  {currentQuestion.question_text || currentQuestion.text}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
              {chatMessages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400 text-sm text-center font-medium px-6">
                    Ask me anything about this question!<br />I&apos;ll explain the concepts simply.
                  </p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm border border-slate-200'
                    }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
                    <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '-0.3s' }}></span>
                    <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '-0.15s' }}></span>
                    <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask a question..."
                  className="flex-1 bg-transparent px-3 py-2 focus:outline-none text-slate-900 placeholder:text-slate-400 text-sm"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* Glass Stat Card */
function GlassCard({ icon, label, value, highlight }) {
  return (
    <div className="rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white/40 shadow-lg hover:-translate-y-1 transition">
      <div className="flex items-center gap-2 text-slate-500 mb-2 text-sm font-semibold uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className={`text-3xl font-bold ${highlight || "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

function QuestionReviewCard({ question, index, onSolveMore, onLearnMore }) {
  const [explanation, setExplanation] = useState("");
  const [loadingExpl, setLoadingExpl] = useState(false);

  const isCorrect = question.user_answer?.toUpperCase() === question.correct_answer?.toUpperCase();

  const handleExplain = async () => {
    if (explanation || loadingExpl) return;
    setLoadingExpl(true);
    try {
      const response = await fetch("/api/llm/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('educoach_token')}`
        },
        body: JSON.stringify({
          question_id: question.id,
          user_answer: question.user_answer || "Skipped"
        })
      });

      if (!response.ok) throw new Error("Failed to fetch explanation");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        setExplanation(prev => prev + text);
      }
    } catch (e) {
      console.error(e);
      setExplanation("Sorry, failed to load explanation. Please try again later.");
    } finally {
      setLoadingExpl(false);
    }
  };

  return (
    <div className={`rounded-2xl p-6 bg-white/60 backdrop-blur-xl border shadow ${isCorrect ? 'border-green-200' : 'border-red-200'}`}>
      <div className="flex justify-between mb-4">
        <span className={`font-bold flex items-center gap-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
          {isCorrect ? <FiCheckCircle /> : <FiXCircle />}
          {isCorrect ? 'Correct' : 'Incorrect'}
        </span>
        <span className="text-sm font-bold text-slate-500">
          Q{index}
        </span>
      </div>

      <p className="text-slate-900 mb-4 whitespace-pre-wrap">
        {question.question_text || question.text}
      </p>

      <div className="space-y-3 mb-6">
        {['A', 'B', 'C', 'D'].map(letter => {
          const optValue = question[`option_${letter.toLowerCase()}`];
          if (!optValue) return null;

          let bg = "bg-slate-50";
          let border = "border-slate-200";
          let label = "";

          if (letter === question.correct_answer) {
            bg = "bg-green-50";
            border = "border-green-300 ring-1 ring-green-300";
            label = "Correct Answer";
          } else if (letter === question.user_answer && letter !== question.correct_answer) {
            bg = "bg-red-50";
            border = "border-red-300 ring-1 ring-red-300";
            label = "Your Answer";
          }

          return (
            <div key={letter} className={`p-4 rounded-xl border ${bg} ${border} relative`}>
              {label && <div className={`text-[10px] font-bold uppercase mb-1 ${label === 'Correct Answer' ? 'text-green-700' : 'text-red-700'}`}>{label}</div>}
              <div className="flex items-start gap-3">
                <span className="font-bold text-slate-400">{letter}.</span>
                <span className="text-slate-800">{optValue}</span>
              </div>
            </div>
          );
        })}
      </div>

      {!isCorrect && !question.user_answer && (
        <div className="p-4 mb-6 bg-orange-50 rounded-xl border border-orange-200 text-orange-800 font-semibold text-sm">
          You skipped this question.
        </div>
      )}

      {/* Explanation Box */}
      {explanation && (
        <div className="mb-6 p-5 bg-blue-50/50 rounded-xl border border-blue-100 text-slate-700 text-sm leading-relaxed">
          <div className="font-bold text-blue-800 mb-2 flex items-center gap-2">
            <FiZap /> AI Explanation
          </div>
          {explanation}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
        {!explanation ? (
          <button
            onClick={handleExplain}
            disabled={loadingExpl}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition"
          >
            {loadingExpl ? "Explaining..." : "Explain this"}
          </button>
        ) : (
          <button
            onClick={() => onLearnMore(question)}
            className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
          >
            💬 Ask more questions
          </button>
        )}
        <button
          onClick={() => onSolveMore(question.topic_id)}
          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
        >
          📚 Solve more from this topic
        </button>
      </div>

    </div>
  );
}

GlassCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  highlight: PropTypes.string
};

QuestionReviewCard.propTypes = {
  question: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  onSolveMore: PropTypes.func.isRequired,
  onLearnMore: PropTypes.func.isRequired,
};

function AiSummary({ testId }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      if (!testId) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/llm/test-analysis/${testId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${localStorage.getItem('educoach_token')}`
          }
        });
        if (!response.ok) throw new Error("Network response was not ok");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done || !active) break;
          const text = decoder.decode(value);
          setSummary(prev => prev + text);
        }
      } catch (e) {
        console.error("Failed to load AI summary", e);
        if (active) setSummary("I noticed you struggled with some topics. Focus on reviewing your weak areas and practice more questions from those topics. You've got this!");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSummary();
    return () => { active = false; };
  }, [testId]);

  if (loading && !summary) {
    return <span className="text-slate-400 italic">Analyzing your test performance...</span>;
  }

  return <span>{summary}</span>;
}

AiSummary.propTypes = {
  testId: PropTypes.number
};