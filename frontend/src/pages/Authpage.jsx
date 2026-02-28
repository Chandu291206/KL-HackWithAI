import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEyeOff, FiEye } from "react-icons/fi";
import { FaGoogle, FaLinkedin, FaGithub } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true); // Default to login to match image
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    examType: "JEE",
    examDate: "",
    dailyHours: 4,
    rememberMe: false
  });

  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        navigate("/dashboard");
      } else {
        const payload = {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email,
          password: formData.password,
          exam_type: formData.examType,
          daily_hours: formData.dailyHours,
          exam_date: formData.examDate ? new Date(formData.examDate).toISOString() : null
        };
        await signup(payload);
        navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 flex items-center justify-center p-4 md:p-8 font-sans text-gray-800">

      <div className="max-w-[70rem] w-full flex flex-col md:flex-row gap-8 items-stretch h-full">

        {/* Left Panel - Information */}
        <div className="hidden md:flex flex-col w-[55%] bg-white/40 backdrop-blur-md rounded-[2rem] p-10 lg:p-14 shadow-sm border border-white/60 relative overflow-hidden">

          <div className="flex items-center gap-3 mb-10 relative z-10">
            <div className="text-emerald-700 bg-emerald-100 p-2 rounded-lg shadow-sm">
              <svg width="24" height="24" viewBox="0 0 48 48">
                <path
                  d="M24 4C25.7 14.2 33.7 22.2 44 24C33.7 25.8 25.7 33.8 24 44C22.2 33.8 14.2 25.8 4 24C14.2 22.2 22.2 14.2 24 4Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold tracking-tight">EduCoach</h2>
          </div>

          <h1 className="text-5xl lg:text-7xl text-gray-700 mb-10 font-serif leading-tight relative z-10" style={{ fontFamily: 'Georgia, serif' }}>
            Welcome to<br />EduCoach<span className="text-gray-400 font-light">|</span>
          </h1>

          <div className="space-y-8 relative z-10 flex-grow pr-4">
            <div>
              <h3 className="text-lg font-bold mb-2 text-gray-900">About EduCoach:</h3>
              <p className="leading-relaxed text-gray-800 font-medium">
                EduCoach is India's premier online platform dedicated to preparing students for competitive JEE and NEET exams, offering personalized learning paths and expert guidance.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2 text-gray-900">Who EduCoach is For:</h3>
              <p className="leading-relaxed text-gray-800 font-medium">
                Ambitious Indian students aiming for top engineering and medical colleges, looking for a structured, result-oriented study plan.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2 text-gray-900">Our Vision</h3>
              <p className="leading-relaxed text-gray-800 font-medium">
                Our Vision is to empower every Indian student to achieve their dream of studying in top institutions through accessible, high-quality online coaching and innovative learning tools.
              </p>
            </div>
          </div>

          {/* Subtle scrollbar placeholder - visual only as per image */}
          <div className="absolute right-4 top-[20%] bottom-[20%] w-1.5 bg-gray-300/40 rounded-full mix-blend-multiply">
            <div className="w-full h-1/3 bg-gray-400/60 rounded-full mt-4"></div>
          </div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="w-full md:w-[45%] flex items-center justify-center relative">

          {/* Glassmorphism Card */}
          <div className="w-full bg-white/40 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] p-8 lg:p-10 border border-white/60 relative z-10">

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              <div className="mb-2">
                <h2 className="text-[1.7rem] leading-tight font-bold text-gray-900">
                  {isLogin ? "Welcome back!" : "Create an account."}
                </h2>
                <h3 className="text-[1.7rem] leading-tight font-bold text-gray-900 mb-3">
                  {isLogin ? "Login to your account." : "Start your journey today."}
                </h3>
                <p className="text-sm text-gray-700 font-medium">
                  {isLogin ? "Your journey to success continues. Ready to study?" : "Join the premier platform for JEE and NEET."}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50/80 backdrop-blur-sm text-red-600 border border-red-200 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Dynamic form based on Login/Signup */}
              {!isLogin && (
                <div className="flex gap-4 flex-col sm:flex-row">
                  <div className="flex-1">
                    <input
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required={!isLogin}
                      placeholder="First Name"
                      className="w-full h-12 px-4 rounded-xl bg-white border border-transparent shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-medium placeholder:text-gray-500 placeholder:font-normal"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required={!isLogin}
                      placeholder="Last Name"
                      className="w-full h-12 px-4 rounded-xl bg-white border border-transparent shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-medium placeholder:text-gray-500 placeholder:font-normal"
                    />
                  </div>
                </div>
              )}

              <div>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder={isLogin ? "Your username or email" : "Email Address"}
                  className="w-full h-12 px-4 rounded-xl bg-white border border-transparent shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-medium placeholder:text-gray-500 placeholder:font-normal"
                />
              </div>

              <div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    placeholder={isLogin ? "Your password" : "Create a password"}
                    className="w-full h-12 px-4 pr-10 rounded-xl bg-white border border-transparent shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-medium placeholder:text-gray-500 placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                  </button>
                </div>
              </div>

              {/* Login Specific: Remember me & Forgot Password */}
              {isLogin && (
                <div className="flex justify-between items-center text-[13px] font-semibold text-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 text-[#1e4b6d] focus:ring-[#1e4b6d] transition-colors shadow-sm"
                    />
                    <span className="group-hover:text-gray-900 transition-colors">Remember me</span>
                  </label>
                  <a href="#" className="text-[#1e4b6d] hover:text-blue-900 transition-colors">
                    Forgot password?
                  </a>
                </div>
              )}

              {/* Signup Specific: Extra fields below */}
              {!isLogin && (
                <div className="space-y-4">
                  <div className="border-t border-gray-400/20 my-2" />

                  <div>
                    <div className="flex bg-white/60 p-1 rounded-xl shadow-sm border border-transparent">
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, examType: "JEE" }))}
                        className={`flex-1 py-1.5 rounded-lg font-bold transition-all text-sm ${formData.examType === "JEE" ? "bg-white text-[#1e4b6d] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        JEE Main/Adv
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, examType: "NEET" }))}
                        className={`flex-1 py-1.5 rounded-lg font-bold transition-all text-sm ${formData.examType === "NEET" ? "bg-white text-[#1e4b6d] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        NEET UG
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <input
                        name="examDate"
                        type="date"
                        value={formData.examDate}
                        onChange={handleInputChange}
                        className="w-full h-11 px-4 rounded-xl bg-white/80 border border-transparent shadow-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all font-medium text-gray-700 text-sm"
                      />
                    </div>
                    <div className="flex flex-col justify-center px-1">
                      <div className="flex justify-between mb-2">
                        <label className="text-xs text-gray-700 font-semibold">Study Hours/Day</label>
                        <span className="text-[#1e4b6d] text-xs font-bold">{formData.dailyHours} Hr</span>
                      </div>
                      <input
                        name="dailyHours"
                        type="range"
                        min="1"
                        max="14"
                        value={formData.dailyHours}
                        onChange={handleInputChange}
                        className="w-full accent-[#1e4b6d]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-1 bg-[#1e4b6d] text-white font-semibold rounded-xl shadow-md hover:bg-[#15344d] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  isLogin ? "Log In" : "Sign Up"
                )}
              </button>

              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 border-t border-gray-400/30" />
                <span className="text-[13px] text-gray-700 font-semibold">or</span>
                <div className="flex-1 border-t border-gray-400/30" />
              </div>

              <div className="flex flex-col gap-3">
                <button type="button" className="w-full h-11 bg-white hover:bg-gray-50 shadow-sm rounded-xl flex items-center justify-center gap-3 text-sm font-bold text-gray-800 transition-colors">
                  <span className="bg-white rounded-full p-0.5"><FaGoogle className="text-lg text-blue-500" /></span>
                  Continue with Google
                </button>
                <button type="button" className="w-full h-11 bg-white hover:bg-gray-50 shadow-sm rounded-xl flex items-center justify-center gap-3 text-sm font-bold text-gray-800 transition-colors">
                  <FaLinkedin className="text-xl text-[#0077b5]" />
                  LinkedIn
                </button>
                <button type="button" className="w-full h-11 bg-white hover:bg-gray-50 shadow-sm rounded-xl flex items-center justify-center gap-3 text-sm font-bold text-gray-800 transition-colors">
                  <FaGithub className="text-xl text-gray-900" />
                  GitHub
                </button>
              </div>

              <p className="text-center text-gray-800 text-sm mt-2 font-medium">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-[#1e4b6d] ml-1.5 font-bold hover:underline"
                >
                  {isLogin ? "Sign up" : "Log In"}
                </button>
              </p>

            </form>
          </div>

        </div>
      </div>
    </div>
  );
}