import React, { useState, useEffect } from "react";
import { FiBell, FiTrendingUp, FiActivity } from "react-icons/fi";
import { getDashboard } from "../api/user";
import { getTestHistory } from "../api/tests";

export default function AnalyticsPage() {
    const [dashboardData, setDashboardData] = useState(null);
    const [testHistory, setTestHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const [dashRes, histRes] = await Promise.all([
                    getDashboard(),
                    getTestHistory()
                ]);

                setDashboardData(dashRes);
                setTestHistory(histRes);
                setError(null);
            } catch (err) {
                console.error("Error fetching analytics data", err);
                setError("Failed to load analytics data");
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
                <FiActivity className="animate-spin text-4xl mb-4" />
                <span className="ml-3 font-medium">Loading your analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-500">
                <p>{error}</p>
            </div>
        );
    }

    // Prepare AI Strategic Advisor dynamic text
    const weakTopics = dashboardData?.topic_health?.weak || [];
    const strongTopics = dashboardData?.topic_health?.strong || [];

    let advisorHeadline = "Keep learning to generate strategic insights.";
    let advisorSubtext = "Complete more tests to unlock detailed topic performance analysis.";

    if (weakTopics.length > 0 && strongTopics.length > 0) {
        advisorHeadline = `Reallocate focus to ${weakTopics[0].name}.`;
        advisorSubtext = `Your portfolio in ${strongTopics[0].name} is performing above market. However, returns in ${weakTopics[0].name} have dipped.`;
    } else if (weakTopics.length > 0) {
        advisorHeadline = `Focus heavily on ${weakTopics[0].name}.`;
        advisorSubtext = `Performance in ${weakTopics[0].name} needs immediate attention to boost overall score.`;
    } else if (strongTopics.length > 0) {
        advisorHeadline = `Great job mastering ${strongTopics[0].name}!`;
        advisorSubtext = `Your performance is stellar. Maintain consistency and start tackling your next weak topic.`;
    }

    // Setup Calendar / Heatmap Active Days (last 17 days for the UI example)
    const today = new Date();
    const last17Days = Array.from({ length: 17 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (16 - i));
        return d.toISOString().split('T')[0];
    });

    const activeDatesSet = new Set(
        testHistory.map(t => new Date(t.created_at).toISOString().split('T')[0])
    );
    // Include last active streak date if applicable
    if (dashboardData?.streak?.last_active) {
        activeDatesSet.add(new Date(dashboardData.streak.last_active).toISOString().split('T')[0]);
    }

    // Radar Chart Data Prep
    const radarValues = dashboardData?.radar_data || {};
    let subjects = ["Physics", "Chemistry", "Math", "Biology"];
    if (dashboardData?.user?.exam_type === "JEE") {
        subjects = ["Physics", "Chemistry", "Math"];
    } else if (dashboardData?.user?.exam_type === "NEET") {
        subjects = ["Physics", "Chemistry", "Biology"];
    }

    const subjectScores = subjects.map(s => radarValues[s] || 50);

    return (
        <div className="relative min-h-screen px-10 py-8 overflow-hidden bg-slate-50/50">

            {/* Background Blobs */}
            <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-[120px]" />
            <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-sky-100/50 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-1/3 w-[450px] h-[450px] bg-indigo-100/40 rounded-full blur-[120px]" />

            <div className="relative z-10 space-y-8 max-w-[1600px] mx-auto">

                {/* HEADER */}
                <div className="flex justify-between items-center bg-white/60 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl px-8 py-5">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">
                            Performance Analytics
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Your learning trajectory visualized.
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="relative p-2 rounded-full hover:bg-white/60 transition">
                            <FiBell className="text-slate-600" />
                            {dashboardData?.pending_suggestions?.length > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            )}
                        </button>

                        {dashboardData?.user?.exam_date && (
                            <div className="flex items-center gap-3 px-4 py-2 bg-white/80 border border-slate-200 rounded-full text-xs font-mono uppercase shadow-sm">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                                Exam Countdown
                                <span className="font-bold text-slate-800 ml-1">
                                    {Math.max(0, Math.ceil((new Date(dashboardData.user.exam_date) - new Date()) / (1000 * 60 * 60 * 24)))} Days
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* TOP GRID */}
                <div className="grid lg:grid-cols-12 gap-6">

                    {/* AI STRATEGIC CARD */}
                    <div className="lg:col-span-7 rounded-2xl overflow-hidden shadow-xl relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" />
                        <div className="absolute inset-0 bg-black/40" />

                        <div className="relative p-8 text-white space-y-6">
                            <div className="text-xs uppercase tracking-widest bg-white/20 backdrop-blur px-3 py-1 rounded-full w-fit">
                                AI Strategic Advisor
                            </div>

                            <h2 className="text-3xl font-serif leading-snug max-w-xl">
                                {advisorHeadline}
                            </h2>

                            <p className="text-slate-200 text-sm max-w-xl border-l-2 border-sky-300/50 pl-4">
                                {advisorSubtext}
                            </p>

                            <button className="bg-white text-slate-900 px-6 py-3 rounded-lg text-sm font-bold hover:bg-sky-50 transition">
                                Review Allocation →
                            </button>
                        </div>
                    </div>

                    {/* RADAR CARD */}
                    <div className="lg:col-span-5 glass-card rounded-2xl p-6 bg-white/60 backdrop-blur-xl border border-white shadow-sm flex flex-col">
                        <div className="flex justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-slate-800">Proficiency Radar</h3>
                                <p className="text-xs text-slate-500 mt-1">Subject strength analysis</p>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 text-[10px] sm:text-xs rounded-full font-bold h-fit">
                                <FiTrendingUp size={14} />
                                Active Focus
                            </div>
                        </div>

                        <div className="flex-1 flex justify-center items-center mt-2">
                            <RadarChart scores={subjectScores} subjects={subjects} />
                        </div>
                    </div>
                </div>

                {/* BOTTOM GRID */}
                <div className="grid lg:grid-cols-12 gap-6">

                    {/* ACTIVITY LEDGER */}
                    <div className="lg:col-span-4 bg-white/60 backdrop-blur-xl border border-white rounded-2xl p-6 shadow-sm flex flex-col">
                        <h3 className="font-bold text-slate-800 mb-6">Activity Ledger</h3>

                        <div className="grid grid-cols-7 gap-2 text-xs text-center flex-1">
                            {last17Days.map((dateStr, i) => {
                                const isActive = activeDatesSet.has(dateStr);
                                return (
                                    <div
                                        key={i}
                                        title={dateStr}
                                        className={`aspect-square flex items-center justify-center rounded-md transition-colors ${isActive
                                            ? "bg-blue-500 text-white font-bold shadow-sm"
                                            : "bg-blue-100/50 text-blue-700/50"
                                            }`}
                                    >
                                        {i + 1}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-between mt-8 pt-6 border-t text-sm">
                            <div>
                                <p className="text-slate-400 text-xs uppercase">Current Streak</p>
                                <p className="font-bold text-lg">{dashboardData?.streak?.current || 0} Days</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-xs uppercase">Longest Streak</p>
                                <p className="font-bold text-lg">{dashboardData?.streak?.longest || 0} Days</p>
                            </div>
                        </div>
                    </div>

                    {/* SCORE TRAJECTORY */}
                    <div className="lg:col-span-8 bg-white/60 backdrop-blur-xl border border-white rounded-2xl p-6 shadow-sm flex flex-col">
                        <div className="flex justify-between mb-8">
                            <div>
                                <h3 className="font-bold text-slate-800">Score Trajectory</h3>
                                <p className="text-xs text-slate-500">Performance index over recent mock tests</p>
                            </div>
                            <div className="text-xs font-bold bg-white border px-3 py-2 rounded-lg shadow-sm">
                                All Subjects
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-end">
                            <LineChart testHistory={testHistory} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------------- Radar Chart ---------------- */

function RadarChart({ scores, subjects = ["Physics", "Chemistry", "Math", "Biology"] }) {
    // scores is an array of floats
    // We map 0-100 to map to center -> edge.
    // SVG center is 100,100. Radius max is 90.
    const centerX = 100;
    const centerY = 100;
    const maxR = 90;

    const numPoints = scores.length || 4;
    // We want to distribute angles evenly starting from the top
    const angles = Array.from({ length: numPoints }, (_, i) => i * (360 / numPoints));

    // Scale 0-100 to 0-maxR
    const pts = scores.map((val, i) => {
        const rad = (angles[i] - 90) * (Math.PI / 180); // -90 to start at top
        const r = (val / 100) * maxR;
        const x = centerX + r * Math.cos(rad);
        const y = centerY + r * Math.sin(rad);
        return { x, y };
    });

    const polygonPoints = pts.map(p => `${p.x},${p.y}`).join(" ");

    const getShortName = (subj) => {
        if (subj === "Physics") return "PHY";
        if (subj === "Chemistry") return "CHE";
        if (subj === "Math" || subj === "Mathematics") return "MAT";
        if (subj === "Biology") return "BIO";
        return subj.substring(0, 3).toUpperCase();
    };

    return (
        <svg viewBox="0 0 200 200" className="w-full max-h-[220px] mx-auto overflow-visible">
            {/* Background grid */}
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, i) => {
                const bgPts = Array.from({ length: numPoints }, (_, j) => {
                    const rad = (angles[j] - 90) * (Math.PI / 180);
                    const r = maxR * scale;
                    const x = centerX + r * Math.cos(rad);
                    const y = centerY + r * Math.sin(rad);
                    return `${x},${y}`;
                }).join(" ");

                return (
                    <polygon
                        key={`bg-${i}`}
                        points={bgPts}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="1"
                    />
                );
            })}

            {/* Axes lines */}
            {angles.map((ang, i) => {
                const rad = (ang - 90) * (Math.PI / 180);
                const x2 = centerX + maxR * Math.cos(rad);
                const y2 = centerY + maxR * Math.sin(rad);
                return <line key={`axis-${i}`} x1={centerX} y1={centerY} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth="1" />;
            })}

            {/* Labels */}
            {subjects.map((subj, i) => {
                const rad = (angles[i] - 90) * (Math.PI / 180);
                const labelR = maxR + 15;
                const x = centerX + labelR * Math.cos(rad);
                const y = centerY + labelR * Math.sin(rad);

                let textAnchor = "middle";
                if (Math.cos(rad) > 0.1) textAnchor = "start";
                else if (Math.cos(rad) < -0.1) textAnchor = "end";

                let yOffset = 4;
                if (Math.sin(rad) < -0.5) yOffset = 0; // top
                if (Math.sin(rad) > 0.5) yOffset = 8;  // bottom

                return (
                    <text
                        key={`label-${i}`}
                        x={x}
                        y={y + yOffset}
                        textAnchor={textAnchor}
                        fontSize="10"
                        fill="#64748b"
                        fontWeight="600"
                    >
                        {getShortName(subj)}
                    </text>
                );
            })}

            <polygon
                points={polygonPoints}
                fill="rgba(59,130,246,0.3)"
                stroke="#3b82f6"
                strokeWidth="2"
                className="transition-all duration-700 ease-in-out"
            />
            {pts.map((p, i) => (
                <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="white"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    className="transition-all duration-700 ease-in-out"
                />
            ))}
        </svg>
    );
}

/* ---------------- Line Chart ---------------- */

function LineChart({ testHistory }) {
    if (!testHistory || testHistory.length === 0) {
        return (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
                No test history available yet.
            </div>
        );
    }

    const scores = testHistory.map(t => Math.max(0, Math.min(100, t.score || 0)));
    const maxScore = 100;

    // Width and height mapping
    const chartW = 600;
    const chartH = 200;

    // Create points
    const stepX = scores.length > 1 ? chartW / (scores.length - 1) : chartW;
    const points = scores.map((s, i) => {
        const x = i * stepX;
        const y = chartH - (s / maxScore) * chartH;
        return { x, y };
    });

    // Create path d string using cubic bezier for smooth curves
    const buildPath = (pts) => {
        if (pts.length === 0) return "";
        if (pts.length === 1) return `M0,${pts[0].y} L${chartW},${pts[0].y}`;

        let path = `M${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            // Control points for smooth curve (horizontal handles)
            const cpx1 = p0.x + (p1.x - p0.x) / 2;
            const cpy1 = p0.y;
            const cpx2 = p0.x + (p1.x - p0.x) / 2;
            const cpy2 = p1.y;
            path += ` C${cpx1},${cpy1} ${cpx2},${cpy2} ${p1.x},${p1.y}`;
        }
        return path;
    };

    const dPath = buildPath(points);
    const areaPath = dPath ? `${dPath} L${chartW},${chartH} L0,${chartH} Z` : "";

    return (
        <div className="relative h-[200px] w-full">
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 25, 50, 75, 100].map(val => {
                    const y = chartH - (val / 100) * chartH;
                    return (
                        <g key={val}>
                            <line x1="0" y1={y} x2={chartW} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                            <text x="-10" y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{val}</text>
                        </g>
                    )
                })}

                {scores.length > 0 && (
                    <>
                        <path
                            d={areaPath}
                            fill="url(#area)"
                            className="transition-all duration-700 ease-in-out"
                        />
                        <path
                            d={dPath}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3"
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-in-out"
                        />

                        {/* Data dots */}
                        {points.map((p, i) => (
                            <circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r="4"
                                fill="white"
                                stroke="#3b82f6"
                                strokeWidth="2"
                                className="transition-all duration-700 ease-in-out hover:r-6 hover:stroke-blue-700 cursor-pointer"
                            >
                                <title>Score: {scores[i].toFixed(1)}%</title>
                            </circle>
                        ))}
                    </>
                )}
            </svg>
        </div>
    );
}
