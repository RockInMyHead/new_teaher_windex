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
import CourseDetail from "./pages/CourseDetail";
import VoiceCallPage from "./pages/VoiceCallPage";
import Achievements from "./pages/Achievements";
import PersonalAccount from "./pages/PersonalAccount";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import Exams from "./pages/Exams";
import ExamAddCourse from "./pages/ExamAddCourse";
import Library from "./pages/Library";
import CourseAssessment from "./pages/CourseAssessment";

// Component to handle TTS cleanup and localStorage cleanup on navigation
const TTSNavigationHandler = () => {
  const location = useLocation();

  useEffect(() => {
    console.log('🧭 Navigation detected:', location.pathname);
  }, [location.pathname]);

  return null;
};

const queryClient = new QueryClient();

const App = () => {
  // App initialization - data cleanup now handled by sessionService and DB
  useEffect(() => {
    console.log('🚀 App initialized');
  }, []);

  return (
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
                <Route path="/available-courses" element={<AvailableCourses />} />
                <Route path="/course/:courseId/select-mode" element={<CourseDetail />} />
                <Route path="/course/:courseId/:mode" element={<CourseDetail />} />
                <Route path="/course/:courseId" element={<CourseDetail />} />
                <Route path="/library" element={<Library />} />
                <Route path="/course-assessment/:courseId" element={<CourseAssessment />} />
                <Route path="/voice-call" element={<VoiceCallPage />} />
                <Route path="/test-route" element={<div style={{padding: '20px', background: 'lightblue'}}><h1>Test Route</h1><p>Route works! Time: {new Date().toLocaleTimeString()}</p><button onClick={() => window.history.back()}>Go Back</button></div>} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/account" element={<PersonalAccount />} />
                <Route path="/exams" element={<Exams />} />
                <Route path="/exams/:examType/add" element={<ExamAddCourse />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
