import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import AuthPage from './pages/Authpage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import LearnPage from './pages/Learnpage.jsx'
import TopicPage from './pages/TopicPage.jsx'
import StudyPlan from './pages/StudyPlan.jsx'
import TestInterface from './pages/TextInterface.jsx'
import TestResults from './pages/TestResults.jsx'
import AIProctoringPage from './pages/AIProctoringPage.jsx'
import BreakTimerPage from './pages/BreakTimerPage.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!token) return <Navigate to="/" replace />;
  return children;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: '/',
        element: <AuthPage />,
      },
      {
        path: '/dashboard',
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
      },
      {
        path: '/learn',
        element: <ProtectedRoute><LearnPage /></ProtectedRoute>,
      },
      {
        path: '/topic/:topicId',
        element: <ProtectedRoute><TopicPage /></ProtectedRoute>,
      },
      {
        path: '/study-plan',
        element: <ProtectedRoute><StudyPlan /></ProtectedRoute>,
      },
      {
        path: '/test',
        element: <ProtectedRoute><TestInterface /></ProtectedRoute>,
      },
      {
        path: '/results',
        element: <ProtectedRoute><TestResults /></ProtectedRoute>,
      },
      {
        path: '/analytics',
        element: <ProtectedRoute><AnalyticsPage /></ProtectedRoute>,
      },
      {
        path: '/ai-proctoring',
        element: <ProtectedRoute><AIProctoringPage /></ProtectedRoute>,
      },
      {
        path: '/AIProctoringPage.jsx',
        element: <Navigate to="/ai-proctoring" replace />,
      },
      {
        path: '/frontend/src/pages/AIProctoringPage.jsx',
        element: <Navigate to="/ai-proctoring" replace />,
      },
      {
        path: '/break-timer',
        element: <ProtectedRoute><BreakTimerPage /></ProtectedRoute>,
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
