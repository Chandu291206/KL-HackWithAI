
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { submitTest, generateTopicTest } from "../api/tests";
import {

  FiArrowLeft,
  FiArrowRight,
  FiFlag,
  FiCheckCircle,
  FiClock,
  FiX
} from "react-icons/fi";

export default function TestInterface() {
  const navigate = useNavigate();
  const [testSession, setTestSession] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeSpent, setTimeSpent] = useState({}); // { question_id: seconds }
  const [lastTick, setLastTick] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [visitedQs, setVisitedQs] = useState([0]); // Track visited indices
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    // Load test from sessionStorage
    const currentTest = sessionStorage.getItem('currentTest');
    if (!currentTest) {
      navigate('/learn');
      return;
    }

    try {
      const parsed = JSON.parse(currentTest);
      setTestSession(parsed);
      // Allocate 2 mins per question
      setTimeLeft(parsed.questions.length * 120);
      setVisitedQs([0]);
    } catch (e) {
      console.error("Failed to parse test session", e);
      navigate('/learn');
    }
  }, [navigate]);

  useEffect(() => {
    // Add current question to visited
    setVisitedQs(prev => {
      if (!prev.includes(currentIndex)) {
        return [...prev, currentIndex];
      }
      return prev;
    });
  }, [currentIndex]);

  useEffect(() => {
    if (!chatOpen) {
      setLastTick(Date.now());
    }
  }, [chatOpen]);

  useEffect(() => {
    if (!testSession || timeLeft <= 0 || chatOpen) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));

      // Update time spent on current question
      const currentQId = testSession.questions[currentIndex].id;
      const now = Date.now();
      const elapsed = Math.round((now - lastTick) / 1000);

      setTimeSpent(prev => ({
        ...prev,
        [currentQId]: (prev[currentQId] || 0) + elapsed
      }));
      setLastTick(now);

    }, 1000);

    return () => clearInterval(timer);
  }, [testSession, currentIndex, lastTick, timeLeft, chatOpen]);

  const handleOptionSelect = (qId, answerText) => {
    setAnswers({ ...answers, [qId]: answerText });
  };

  const handleSubmit = async () => {
    if (!testSession || submitting) return;

    // Format answers array for backend
    const answersArray = testSession.questions.map(q => ({
      question_id: q.id,
      user_answer: answers[q.id] || "",
      time_spent_seconds: timeSpent[q.id] || 0
    }));

    try {
      setSubmitting(true);
      const result = await submitTest(testSession.testId, answersArray);

      // Store result and questions for the results page
      sessionStorage.setItem('testResult', JSON.stringify({
        ...result,
        questions: testSession.questions
      }));

      // Clear current test
      sessionStorage.removeItem('currentTest');
      navigate('/results');
    } catch (err) {
      console.error("Failed to submit test", err);
      alert("Failed to submit test. Please try again.");
      setSubmitting(false);
    }
  };

  const handleSolveMore = async () => {
    if (!testSession || submitting || chatOpen) return;

    // Auto-submit current test first
    const answersArray = testSession.questions.map(q => ({
      question_id: q.id,
      user_answer: answers[q.id] || "",
      time_spent_seconds: timeSpent[q.id] || 0
    }));

    try {
      setSubmitting(true);
      const result = await submitTest(testSession.testId, answersArray);

      sessionStorage.setItem('testResult', JSON.stringify({
        ...result,
        questions: testSession.questions
      }));

      // Generate a new topic test
      const newTestData = await generateTopicTest(currentQ.topic_id, 7, "mixed");

      const newSession = {
        ...newTestData,
        testId: newTestData.test_id,
        testName: `Topic Drill`
      };

      sessionStorage.setItem('currentTest', JSON.stringify(newSession));

      setTestSession(newSession);
      setCurrentIndex(0);
      setAnswers({});
      setTimeLeft(newSession.questions.length * 120);
      setTimeSpent({});
      setSubmitting(false);

    } catch (err) {
      console.error("Failed to transition to topic test", err);
      alert("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

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
          topic_id: currentQ.topic_id,
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
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I am offline right now." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!testSession) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading test...</div>;
  }

  const questions = testSession.questions;
  const currentQ = questions[currentIndex];

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="bg-[#f0f4f8] text-[#1e293b] min-h-screen flex flex-col font-sans relative">
      {/* Top Banner indicating progress (optional, replacing the old distinct bar) */}
      <div className="h-1.5 bg-white relative z-20 shadow-sm overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-[#3b82f6] transition-all duration-300 rounded-r-full"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* HEADER */}
      <header className="flex justify-between items-center px-4 py-3 md:px-8 md:py-4 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] z-10 border-b border-transparent">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/learn')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors">
            <FiArrowLeft className="text-xl" />
          </button>

          <div>
            <h1 className="text-xl font-bold text-[#0f172a] leading-tight">
              {testSession.testName || "Physics Mock Test #4"}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              <span className="text-[#3b82f6] bg-[#eff6ff] px-2 py-0.5 rounded-md">
                {testSession.topic_name || "PHYSICS"}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                SECTION 1
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 md:gap-6 items-center">
          <div className="bg-[#eff6ff] text-[#3b82f6] border border-[#dbeafe] px-5 py-2 md:py-2.5 rounded-[1rem] flex flex-col items-center min-w-[120px]">
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-80 mb-0.5">TIME LEFT</span>
            <div className="flex items-center gap-2 font-mono text-[1.1rem] font-bold leading-none tracking-wider">
              <FiClock className="text-sm stroke-[3]" />
              {formatTime(timeLeft)}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <ToolIcon icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>} />
            <ToolIcon icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>} onClick={() => setShowInstructions(true)} />
            <ToolIcon icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>} />
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10 flex justify-center pb-32">

        {/* CENTER CONTENT CONTAINER */}
        <div className="w-full max-w-[900px] flex flex-col gap-6 relative">

          {/* QUESTION CARD */}
          <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100">

            {/* Question Header */}
            <div className="flex justify-between items-start mb-10">
              <div className="flex items-center gap-3">
                <span className="bg-[#eff6ff] text-[#3b82f6] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.15em] rounded-md">
                  SINGLE CHOICE
                </span>
                <span className="border border-slate-200 text-slate-400 px-3 py-1 text-[11px] font-mono uppercase rounded-md tracking-wider">
                  ID: {currentQ.id || "893201"}
                </span>
              </div>

              <button className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm font-semibold transition-colors uppercase tracking-wider text-[11px]">
                <FiFlag className="stroke-[2.5]" size={14} />
                Report
              </button>
            </div>

            {/* Question Title */}
            <div className="flex items-end gap-5 mb-10">
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] tracking-tight leading-none">
                Question {currentIndex + 1}
              </h2>
              <div className="bg-[#ecfdf5] text-[#10b981] px-3 py-1 rounded-full text-[13px] font-bold flex items-center mb-1">
                (+4, -1)
              </div>
            </div>

            {/* Question Body */}
            <div className="text-[#334155] text-[1.15rem] leading-[1.8] mb-4 pb-6">
              {currentQ.question_text || (
                <>
                  <p className="mb-4">
                    A particle of mass <strong className="text-[#3b82f6]">m</strong> moves in a circular orbit of radius <strong className="text-[#3b82f6]">r</strong> under a central attractive force <strong className="text-[#3b82f6]">F = -k/r</strong>.
                  </p>
                  <p>
                    What is the total energy of the particle?
                  </p>
                </>
              )}
            </div>

            {/* AI Help Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 mb-2">
              <button
                onClick={handleSolveMore}
                disabled={submitting}
                className="bg-[#f8fafc] text-[#3b82f6] px-5 py-3 rounded-xl font-semibold hover:bg-[#eff6ff] transition-all disabled:opacity-50 text-sm flex-1 sm:flex-none justify-center items-center flex gap-2 border border-slate-100"
              >
                📚 Solve more from this topic
              </button>
              <button
                onClick={() => setChatOpen(true)}
                disabled={submitting}
                className="bg-[#f8fafc] text-[#8b5cf6] px-5 py-3 rounded-xl font-semibold hover:bg-[#f5f3ff] transition-all disabled:opacity-50 text-sm flex-1 sm:flex-none justify-center items-center flex gap-2 border border-slate-100"
              >
                🤖 Learn more about this topic
              </button>
            </div>

          </div>

          {/* OPTIONS GRID */}
          <div className="grid sm:grid-cols-2 gap-4 md:gap-5 relative z-10 -mt-2">
            {[
              { letter: 'A', value: currentQ.option_a || '-k/2r' },
              { letter: 'B', value: currentQ.option_b || 'k/2r' },
              { letter: 'C', value: currentQ.option_c || '-k/r' },
              { letter: 'D', value: currentQ.option_d || 'k/r' }
            ].map((opt) => (
              <Option
                key={opt.letter}
                letter={opt.letter}
                value={opt.value}
                selected={answers[currentQ.id]}
                setSelected={(val) => handleOptionSelect(currentQ.id, val)}
              />
            ))}
          </div>

          {/* BOTTOM PAGINATION STRIP (Drawn from the image styling) */}
          <div className="flex justify-center mt-8 -mb-10 relative z-20">
            <div className="bg-white/95 backdrop-blur-xl px-2.5 py-2.5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white flex items-center overflow-x-auto max-w-full">
              {[...Array(questions.length)].map((_, i) => {
                const qId = questions[i].id;
                let status = "unvisited";
                if (answers[qId]) status = "answered";
                else if (visitedQs.includes(i)) status = "visited";

                return (
                  <PaginationDot
                    key={i}
                    number={i + 1}
                    status={status}
                    isActive={currentIndex === i}
                    onClick={() => setCurrentIndex(i)}
                  />
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 px-4 md:px-8 py-4 sm:py-5 flex justify-between items-center z-30 shadow-[0_-4px_20px_rgb(0,0,0,0.02)]">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="bg-transparent text-[#64748b] hover:text-[#0f172a] px-4 sm:px-6 py-2.5 sm:py-3 rounded-[1.5rem] flex items-center gap-3 font-extrabold text-[12px] tracking-[0.1em] transition-all disabled:opacity-40 disabled:cursor-not-allowed uppercase hover:bg-slate-50"
        >
          <FiArrowLeft className="stroke-[3] text-lg" />
          PREVIOUS
        </button>

        <div className="hidden md:flex flex-1 justify-center relative left-10 items-center gap-3 text-[#64748b] hover:text-[#475569] transition-colors cursor-pointer font-extrabold text-[12px] uppercase tracking-[0.1em]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#94a3b8]"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          MARK FOR REVIEW
          <span className="w-1 h-1 bg-slate-300 rounded-full mx-6 hidden lg:inline-block"></span>
          <button className="hidden lg:flex items-center gap-2 hover:text-slate-800 transition-colors" onClick={() => setShowSummary(true)}>
            <ToolIcon className="!w-6 !h-6" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px]"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>} />
            SUMMARY
          </button>
        </div>

        {currentIndex === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-8 sm:px-10 py-3 sm:py-3.5 rounded-full font-extrabold text-[12px] tracking-[0.1em] flex items-center gap-3 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] disabled:opacity-70 disabled:cursor-not-allowed uppercase"
          >
            {submitting ? "SUBMITTING..." : "SUBMIT TEST"}
            <FiCheckCircle className="stroke-[3] text-lg" />
          </button>
        ) : (
          <button
            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-8 sm:px-10 py-3 sm:py-3.5 rounded-full font-extrabold text-[12px] tracking-[0.1em] flex items-center gap-3 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] uppercase"
          >
            NEXT
            <FiArrowRight className="stroke-[3] text-lg" />
          </button>
        )}
      </div>

      {/* MODALS AND OVERLAYS (Unchanged Logic, mostly styling tweaks for consistency) */}

      {/* TOPIC CHAT OVERLAY */}
      {chatOpen && (
        <div className="fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw-32px)] h-[600px] max-h-[calc(100vh-100px)] bg-white rounded-2xl shadow-2xl z-50 flex flex-col border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-8">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-[#f5f3ff] text-[#6d28d9]">
            <div className="font-extrabold text-xl flex items-center gap-3">
              <span className="text-2xl">🤖</span> AI Tutor
            </div>
            <button onClick={() => setChatOpen(false)} className="p-2 hover:bg-[#ede9fe] rounded-full text-[#6d28d9] transition-colors">
              <FiX size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center text-slate-500 my-10 font-medium">
                Ask me anything about this topic! I'll explain the concepts simply.
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[#3b82f6] text-white rounded-br-sm' : 'bg-[#f1f5f9] text-[#334155] rounded-bl-sm'} shadow-sm`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-[#f1f5f9] p-4 rounded-2xl rounded-bl-sm text-slate-400 font-medium">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2 bg-[#f8fafc] p-2 rounded-2xl border border-slate-200">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent px-4 py-2 focus:outline-none text-[#0f172a] placeholder:text-slate-400"
              />
              <button
                onClick={handleSendMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white p-3 rounded-xl disabled:opacity-50 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION SUMMARY / PALETTE MODAL OVERLAY */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] max-w-2xl w-full flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-2xl font-extrabold text-[#0f172a]">Questions Summary</h2>
              <button
                onClick={() => setShowSummary(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors border-none"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-[#334155]">
              {/* Legend */}
              <div className="flex flex-wrap gap-4 items-center justify-center bg-[#f8fafc] p-4 rounded-[1.5rem] border border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <div className="w-3 h-3 rounded-full bg-[#3b82f6]" /> Answered
                </div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]" /> Not Answered
                </div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <div className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300" /> Not Visited
                </div>
              </div>

              {/* Grid of Pagination Dots */}
              <div className="grid grid-cols-5 md:grid-cols-8 gap-4 place-items-center mt-6">
                {[...Array(questions.length)].map((_, i) => {
                  const qId = questions[i].id;
                  let status = "unvisited";
                  if (answers[qId]) status = "answered";
                  else if (visitedQs.includes(i)) status = "visited";

                  return (
                    <PaginationDot
                      key={i}
                      number={i + 1}
                      status={status}
                      isActive={currentIndex === i}
                      onClick={() => {
                        setCurrentIndex(i);
                        setShowSummary(false); // Close on jump
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


/* COMPONENTS */

function Option({ letter, value, selected, setSelected }) {
  const active = selected === letter;

  return (
    <div
      onClick={() => setSelected(letter)}
      className={`bg-white rounded-[1.5rem] p-5 cursor-pointer transition-all duration-200 relative flex items-center gap-5 border-2 ${active
        ? "border-transparent bg-white shadow-[0_4px_25px_rgba(59,130,246,0.1)] ring-[2.5px] ring-[#3b82f6] z-10"
        : "border-transparent shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:border-slate-100 hover:shadow-[0_4px_25px_rgb(0,0,0,0.06)]"
        }`}
    >
      {/* Letter Icon */}
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-sm tracking-widest shrink-0 transition-colors ${active
          ? "bg-[#3b82f6] text-white shadow-md shadow-[#3b82f6]/30"
          : "bg-white border-[1.5px] border-[#e2e8f0] text-[#64748b] font-bold"
          }`}
      >
        {letter}
      </div>

      {/* Option Value */}
      <div className={`font-serif text-[1.1rem] ${active ? "text-[#0f172a] font-semibold" : "text-[#475569]"}`}>
        {value}
      </div>
    </div>
  );
}

function PaginationDot({ number, status, isActive, onClick }) {
  // Base style
  let bgClass = "bg-transparent text-[#94a3b8] font-bold hover:bg-slate-100";
  let borderClass = "border-transparent text-[13px]";
  let extraClass = "";

  if (status === "answered") {
    bgClass = "bg-[#eff6ff] text-[#3b82f6] font-bold";
    borderClass = "border-transparent";
  } else if (status === "visited") {
    bgClass = "bg-white text-[#ef4444] font-bold shadow-sm";
    borderClass = "border-transparent";
    // We recreate the subtle drop shadow on un-answered visited questions
    extraClass = "shadow-[0_2px_8px_rgba(239,68,68,0.15)] ring-1 ring-[#fef2f2]";
  }

  // Active state overrides
  if (isActive) {
    bgClass = "bg-[#3b82f6] text-white font-extrabold shadow-md shadow-[#3b82f6]/30";
    borderClass = "border-transparent";
    extraClass = "ring-2 ring-white";
  }

  return (
    <button
      onClick={onClick}
      className={`w-[42px] h-[42px] mx-[3px] rounded-full transition-all flex items-center justify-center flex-shrink-0 ${bgClass} ${borderClass} ${extraClass}`}
    >
      {number}
    </button>
  );
}

function ToolIcon({ icon, onClick, className }) {
  return (
    <button
      onClick={onClick}
      className={`w-[38px] h-[38px] rounded-full hover:bg-slate-100 text-[#94a3b8] hover:text-[#475569] flex items-center justify-center cursor-pointer transition-colors ${className || ""}`}
    >
      {icon}
    </button>
  );
}