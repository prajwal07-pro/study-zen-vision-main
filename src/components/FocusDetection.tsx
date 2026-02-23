import { useEffect, useRef, useState } from "react";
import { Camera, AlertCircle, CheckCircle2, Loader2, Bell, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import * as tmImage from "@teachablemachine/image";
import { startContinuousAlarm, stopContinuousAlarm, isAlarmPlaying } from "@/utils/beep";

interface FocusState {
  isFocused: boolean;
  confidence: number;
  status: "loading" | "ready" | "detecting" | "error";
  error?: string;
  predictions?: { className: string; probability: number }[];
}

interface FocusDetectionProps {
  onDistractedTooLong?: () => void;
}

const FocusDetection = ({ onDistractedTooLong }: FocusDetectionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Hidden canvas for Python frames
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<tmImage.CustomMobileNet | null>(null);
  const animationFrameRef = useRef<number>();
  
  const distractedTimeRef = useRef<number>(0);
  const focusedTimeRef = useRef<number>(0);
  
  // Python State tracking inside refs to avoid stale closures in intervals
  const pythonEyesDetectedRef = useRef<boolean | null>(null); 
  const [pythonStatus, setPythonStatus] = useState<boolean | null>(null);

  const [focusState, setFocusState] = useState<FocusState>({
    isFocused: false,
    confidence: 0,
    status: "loading",
  });

  const [alarmActive, setAlarmActive] = useState(false);

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            loadModel();
          };
        }
      } catch (err) {
        setFocusState({
          isFocused: false,
          confidence: 0,
          status: "error",
          error: "Camera access denied. Please enable camera permissions.",
        });
      }
    };

    startWebcam();

    // Start the Python Hybrid check interval (Runs 1 time per second)
    const pythonInterval = setInterval(checkPythonBackend, 1000);

    return () => {
      clearInterval(pythonInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopContinuousAlarm();
    };
  }, []);

  // --- HYBRID FEATURE: Communicate with Python server.py ---
  const checkPythonBackend = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw current video frame to hidden canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Convert to base64 (Lower quality to make the HTTP request fast)
      const base64Image = canvas.toDataURL('image/jpeg', 0.5);

      // Send to Flask server
      const response = await fetch("http://localhost:5000/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image })
      });

      const data = await response.json();
      pythonEyesDetectedRef.current = data.eyes_detected;
      setPythonStatus(data.eyes_detected);

    } catch (err) {
      // If Python server is not running, we degrade gracefully to just TM model
      pythonEyesDetectedRef.current = null;
      setPythonStatus(null);
    }
  };

  const loadModel = async () => {
    try {
      const modelURL = window.location.origin + "/models/model.json";
      const metadataURL = window.location.origin + "/models/metadata.json";
      
      const model = await tmImage.load(modelURL, metadataURL);
      modelRef.current = model;
      
      setFocusState((prev) => ({ ...prev, status: "ready" }));
      startDetection();
    } catch (error) {
      setFocusState({
        isFocused: false,
        confidence: 0,
        status: "error",
        error: "Model loading failed. Check if model files are in public/models/",
      });
    }
  };

  const startDetection = () => {
    const detect = async () => {
      if (!videoRef.current || !modelRef.current) return;

      try {
        const predictions = await modelRef.current.predict(videoRef.current);
        const sortedPredictions = predictions.sort((a, b) => b.probability - a.probability);
        const topPrediction = sortedPredictions[0];
        
        // 1. Teachable Machine Model Check
        const isTmFocused = topPrediction.className.toLowerCase().includes("focused");
        const confidence = topPrediction.probability;

        // 2. Hybrid Check (Combine TM model with Python Eye Detection)
        // If Python is offline (null), we just use TM. Otherwise, BOTH must be true.
        const pythonEyes = pythonEyesDetectedRef.current;
        const isFocused = isTmFocused && (pythonEyes === null || pythonEyes === true);

        // Handle distraction tracking and alarm
        if (!isFocused) {
          distractedTimeRef.current += 1; 
          focusedTimeRef.current = 0; 
          
          if (distractedTimeRef.current >= 15 && !isAlarmPlaying()) {
            startContinuousAlarm(1200, 400, 300);
            setAlarmActive(true);
            onDistractedTooLong?.();
          }
        } else {
          distractedTimeRef.current = 0; 
          focusedTimeRef.current += 1; 
          
          if (focusedTimeRef.current >= 2 && isAlarmPlaying()) {
            stopContinuousAlarm();
            setAlarmActive(false);
          }
        }

        setFocusState({
          isFocused,
          confidence,
          status: "detecting",
          predictions: sortedPredictions,
        });

        setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(detect);
        }, 1000);
      } catch (error) {
        console.error("Detection error:", error);
      }
    };

    detect();
  };

  return (
    <div className="space-y-4">
      {/* Hidden canvas for extracting frames for Python */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="relative rounded-lg overflow-hidden bg-black/50 aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        
        {/* Python Eye Tracking Status Overlay */}
        <div className="absolute top-4 left-4 bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm backdrop-blur-md">
          <Eye className={`h-4 w-4 ${pythonStatus === true ? 'text-green-400' : pythonStatus === false ? 'text-red-400' : 'text-gray-400'}`} />
          <span className="text-white/80 font-medium">
            {pythonStatus === true ? "Eyes Detected (Python)" : pythonStatus === false ? "No Eyes (Python)" : "Python Server Offline"}
          </span>
        </div>
        
        {alarmActive && (
          <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse shadow-lg">
            <Bell className="h-5 w-5 animate-bounce" />
            <span className="font-bold">REFOCUS!</span>
          </div>
        )}
        
        {focusState.status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <Loader2 className="h-12 w-12 mx-auto mb-2 animate-spin" />
              <p className="text-lg">Loading hybrid detection models...</p>
            </div>
          </div>
        )}
      </div>

      {focusState.status === "error" ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{focusState.error}</AlertDescription>
        </Alert>
      ) : focusState.status === "detecting" ? (
        <div className="space-y-3">
          {alarmActive && (
            <div className="bg-red-500/20 border-2 border-red-500 rounded-lg p-4 flex items-start gap-3 animate-pulse">
              <Bell className="h-6 w-6 text-red-400 mt-0.5 animate-bounce" />
              <div>
                <p className="text-red-400 font-bold text-lg">⚠️ DISTRACTION ALERT!</p>
                <p className="text-sm text-white/90 mt-1">
                  Alarm will stop when you focus for 2 seconds
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-lg bg-white/10">
            <div className="flex items-center gap-3">
              {focusState.isFocused ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                  <div>
                    <span className="font-semibold text-green-400 text-lg">Focused ✓</span>
                    <p className="text-xs text-white/70">
                      {alarmActive ? `Hold focus... ${focusedTimeRef.current}s` : "Great work!"}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-yellow-400" />
                  <div>
                    <span className="font-semibold text-yellow-400 text-lg">
                      Distracted
                    </span>
                    <p className="text-xs text-white/70">
                      {distractedTimeRef.current}s distracted
                      {distractedTimeRef.current >= 15 ? " - ALARM ACTIVE!" : ""}
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">
                {(focusState.confidence * 100).toFixed(0)}%
              </span>
              <p className="text-xs text-white/70">AI Confidence</p>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
};

export default FocusDetection;