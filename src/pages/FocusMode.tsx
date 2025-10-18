import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  Monitor,
  Bot,
  Clock,
  X,
  Pause,
  Play,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import FocusDetection from "@/components/FocusDetection";
import ScreenActivityDetector from "@/components/ScreenActivityDetector";
import AIFocusAssistant from "@/components/AIFocusAssistant";
import QuizGenerator from "@/components/QuizGenerator";
import { useToast } from "@/hooks/use-toast";

// --- Firebase Imports ---
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebaseConfig"; // Your Firebase config file

const FocusMode = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // --- Get data from URL ---
  const userId = searchParams.get("userId");
  const durationMinutes = parseInt(searchParams.get("duration") || "25");
  const screenGranted = searchParams.get("screenGranted") === "true";
  const initialDuration = durationMinutes * 60;

  // --- State Management ---
  const [sessionStartTime] = useState(new Date()); // Record session start time
  const [timeRemaining, setTimeRemaining] = useState(initialDuration);
  const [isPaused, setIsPaused] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  // Section visibility toggles
  const [showCamera, setShowCamera] = useState(true);
  const [showScreen, setShowScreen] = useState(true);
  const [showAssistant, setShowAssistant] = useState(true);

  // --- Timer Logic ---
  useEffect(() => {
    if (isPaused || timeRemaining <= 0 || showQuiz) {
      if (timeRemaining <= 0 && !showCompletionDialog && !showQuiz) {
        handleSessionEnd(true); // Call end function when timer reaches zero
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, timeRemaining, showCompletionDialog, showQuiz]);


  // --- Data Saving and Navigation ---

  const handleSessionEnd = async (completed: boolean) => {
    if (!userId) {
      console.error("No user ID found, cannot save session.");
      // If no user, just show the quiz without saving
      setShowCompletionDialog(completed);
      setTimeout(() => {
        setShowCompletionDialog(false);
        setShowQuiz(true);
      }, completed ? 3000 : 0);
      return;
    }

    try {
      // Save the focus session data to Firestore
      await addDoc(collection(db, `students/${userId}/focus_sessions`), {
        startTime: sessionStartTime.toISOString(),
        endTime: new Date().toISOString(),
        durationMinutes: durationMinutes,
        completed: completed,
      });

      if (completed) {
        toast({ title: "Focus Session Saved!", description: "Great work!" });
      }
    } catch (error) {
      console.error("Error saving focus session:", error);
      toast({ variant: "destructive", title: "Save Error", description: "Could not save your focus session data." });
    }

    // Show completion dialog if finished, then transition to quiz
    if (completed) {
      setShowCompletionDialog(true);
      setTimeout(() => {
        setShowCompletionDialog(false);
        setShowQuiz(true);
      }, 3000);
    } else {
      // If exiting early, go straight to the quiz
      setShowQuiz(true);
    }
  };

  const handleQuizSubmit = async (topic: string, score: number, totalQuestions: number) => {
    if (!userId) {
      console.error("No user ID found, cannot save quiz result.");
      navigate("/"); // Just go home if no user
      return;
    }

    try {
        // Save quiz result to Firestore
        await addDoc(collection(db, `students/${userId}/quiz_results`), {
            topic: topic,
            score: score,
            total: totalQuestions,
            date: new Date().toISOString(),
        });
        toast({ title: "Quiz Result Saved!", description: `You scored ${score}/${totalQuestions}.` });
    } catch (error) {
        console.error("Error saving quiz result:", error);
        toast({ variant: "destructive", title: "Save Error", description: "Could not save your quiz result." });
    }

    navigate("/"); // Navigate home after quiz submission
  };

  const handleExitEarly = () => {
    if (confirm("Are you sure you want to exit? Your session will be marked as incomplete.")) {
      handleSessionEnd(false);
    }
  };

  const handleSkipQuizAndExit = () => {
    navigate("/");
  };

  // --- UI Helper Functions ---
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    const percentRemaining = (timeRemaining / initialDuration) * 100;
    if (percentRemaining > 50) return "text-green-400";
    if (percentRemaining > 20) return "text-yellow-400";
    return "text-red-400";
  };

  const getProgressPercentage = () => {
    return ((initialDuration - timeRemaining) / initialDuration) * 100;
  };

  // --- Conditional Rendering for Quiz Screen ---
  if (showQuiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6 flex items-center justify-center">
        <div className="w-full max-w-4xl">
          <QuizGenerator onQuizSubmit={handleQuizSubmit} />
          <div className="text-center mt-6">
            <Button
              onClick={handleSkipQuizAndExit}
              variant="outline"
              className="text-white border-white/30 hover:bg-white/10"
            >
              Skip Quiz & Go Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Focus Mode UI ---
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-6">
        <div className="max-w-7xl mx-auto mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-lg backdrop-blur-md">
                <Eye className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Focus Mode</h1>
                <Badge className="bg-green-500/20 text-green-300 border-green-500 mt-1">
                  ● Session Active
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Card className="bg-white/10 backdrop-blur-md border-white/20 px-8 py-4">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                    <Clock className="h-4 w-4" />
                    Time Remaining
                  </div>
                  <span className={`text-4xl font-mono font-bold ${getTimeColor()}`}>
                    {formatTime(timeRemaining)}
                  </span>
                  <div className="w-full mt-2">
                    <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-400 to-blue-400 h-full transition-all duration-1000"
                        style={{ width: `${getProgressPercentage()}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
              <Button
                onClick={() => setIsPaused(!isPaused)}
                size="lg"
                className={isPaused ? "bg-green-500 hover:bg-green-600" : "bg-yellow-500 hover:bg-yellow-600"}
              >
                {isPaused ? <Play className="h-5 w-5 mr-2" /> : <Pause className="h-5 w-5 mr-2" />}
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button onClick={handleExitEarly} variant="destructive" size="lg">
                <X className="h-5 w-5 mr-2" />
                Exit
              </Button>
            </div>
          </div>
          {isPaused && (
            <Card className="mt-4 bg-yellow-500/20 border-yellow-500 p-3">
              <div className="flex items-center gap-2 text-yellow-300">
                <AlertCircle className="h-5 w-5" />
                <span className="font-semibold">Session Paused - Click Resume to continue</span>
              </div>
            </Card>
          )}
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Eye className="h-5 w-5" /> Face Focus</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCamera(!showCamera)}>
                {showCamera ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            {showCamera && <FocusDetection onDistractedTooLong={() => console.log("Student distracted!")} />}
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Monitor className="h-5 w-5" /> Screen Activity</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowScreen(!showScreen)}>
                {showScreen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            {showScreen && <ScreenActivityDetector autoStart={screenGranted} />}
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 p-6 xl:col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Bot className="h-5 w-5" /> AI Assistant</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowAssistant(!showAssistant)}>
                {showAssistant ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            {showAssistant && <AIFocusAssistant />}
          </Card>
        </div>

        <div className="max-w-7xl mx-auto mt-6">
          <Card className="bg-white/5 backdrop-blur-md border-white/10 p-4">
            <div className="flex items-center justify-between text-sm text-white/60">
              <div className="flex items-center gap-6">
                <span>🎯 Focus Mode Active</span>
                <span>📹 Camera: Monitoring</span>
                <span>🖥️ Screen: Analyzing</span>
                <span>🤖 AI: Ready</span>
                <span>⏱️ Duration: {durationMinutes} min</span>
              </div>
              <div>
                <span>Press Exit to take a quiz</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={showCompletionDialog}>
        <DialogContent className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-none">
          <DialogHeader>
            <div className="flex justify-center mb-4"><CheckCircle className="h-16 w-16 text-white" /></div>
            <DialogTitle className="text-3xl text-center">🎉 Session Complete!</DialogTitle>
            <DialogDescription className="text-white/90 text-center text-lg">
              Congratulations! You've completed your {durationMinutes}-minute focus session.
              <br />
              <strong className="text-white">Now let's test what you learned!</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="text-center mt-4"><p className="text-white/80 animate-pulse">Preparing quiz...</p></div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FocusMode;