import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CoursesPage from "./pages/CoursesPage";
import AvailableCourses from "./pages/AvailableCourses";
import Chat from "./pages/Chat";
import Lesson from "./pages/Lesson";
import LessonDetail from "./pages/LessonDetail";
import CourseDetail from "./pages/CourseDetail";
import VoiceCallPage from "./pages/VoiceCallPage";
import VideoCall from "./pages/VideoCall";
import Achievements from "./pages/Achievements";
import AssessmentLevel from "./pages/AssessmentLevel";
import PersonalAccount from "./pages/PersonalAccount";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import StreamingChatTest from "./examples/StreamingChatTest";
import GradeSelection from "./pages/GradeSelection";
import Exams from "./pages/Exams";
import ExamAddCourse from "./pages/ExamAddCourse";

// Component to handle TTS cleanup on navigation
const TTSNavigationHandler = () => {
  const location = useLocation();

  useEffect(() => {
    console.log('🧭 Navigation detected:', location.pathname);
  }, [location.pathname]);

  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <TTSNavigationHandler />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/grade-selection" element={<GradeSelection />} />
                <Route path="/available-courses" element={<AvailableCourses />} />
                <Route path="/lesson" element={<Lesson />} />
                <Route path="/lesson/:lessonId" element={<LessonDetail />} />
                <Route path="/course/:courseId/select-mode" element={<CourseDetail />} />
                <Route path="/course/:courseId/:mode" element={<CourseDetail />} />
                <Route path="/voice-call" element={<VoiceCallPage />} />
                <Route path="/test-route" element={<div style={{padding: '20px', background: 'lightblue'}}><h1>Test Route</h1><p>Route works! Time: {new Date().toLocaleTimeString()}</p><button onClick={() => window.history.back()}>Go Back</button></div>} />
                <Route path="/call" element={<VideoCall />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/assessment-level" element={<AssessmentLevel />} />
                <Route path="/account" element={<PersonalAccount />} />
                <Route path="/exams" element={<Exams />} />
                <Route path="/exams/:examType/add" element={<ExamAddCourse />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/streaming-test" element={<StreamingChatTest />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
