import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Clock, Timer, Monitor, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TimeSelection = () => {
  const navigate = useNavigate();
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [showScreenDialog, setShowScreenDialog] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [isRequestingScreen, setIsRequestingScreen] = useState(false);

  const presetDurations = [15, 25, 45, 60, 90];

  const handleStart = () => {
    const duration = selectedMinutes || parseInt(customMinutes);
    if (duration && duration > 0) {
      // Show screen sharing dialog
      setShowScreenDialog(true);
      setScreenError("");
    }
  };

  const requestScreenShare = async () => {
    setIsRequestingScreen(true);
    setScreenError("");

    try {
      // Request screen share with explicit "monitor" preference
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor", // Only allow entire screen
        },
        audio: false,
        preferCurrentTab: false,
      });

      // Check what was actually shared
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      console.log("Screen share settings:", settings);

      // Validate that entire screen was shared (not window or tab)
      // @ts-ignore - displaySurface exists but not in TS types
      const displaySurface = settings.displaySurface || videoTrack.getConstraints().displaySurface;
      
      if (displaySurface !== "monitor") {
        // User selected window or tab instead of entire screen
        stream.getTracks().forEach(track => track.stop());
        
        setScreenError(
          `❌ You must share your ENTIRE SCREEN, not a window or tab. Please try again.`
        );
        setIsRequestingScreen(false);
        return;
      }

      // Success! Entire screen was shared
      console.log("✅ Entire screen shared successfully");
      
      // Stop the stream for now (will restart in FocusMode)
      stream.getTracks().forEach(track => track.stop());

      // Navigate to Focus Mode with duration and screen permission granted
      const duration = selectedMinutes || parseInt(customMinutes);
      navigate(`/focus?duration=${duration}&screenGranted=true`);

    } catch (error: any) {
      console.error("Screen share error:", error);
      
      if (error.name === "NotAllowedError") {
        setScreenError("❌ Screen sharing was denied. Please allow screen sharing to continue.");
      } else if (error.name === "NotFoundError") {
        setScreenError("❌ No screen available to share.");
      } else {
        setScreenError(`❌ Error: ${error.message || "Screen sharing failed"}`);
      }
      
      setIsRequestingScreen(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <Card className="w-full max-w-2xl p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mb-4">
              <Timer className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Focus Mode
            </h1>
            <p className="text-muted-foreground">
              Select your focus duration and stay productive
            </p>
          </div>

          {/* Quick Select */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Quick Select</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {presetDurations.map((minutes) => (
                <Button
                  key={minutes}
                  variant={selectedMinutes === minutes ? "default" : "outline"}
                  onClick={() => {
                    setSelectedMinutes(minutes);
                    setCustomMinutes("");
                  }}
                  className="h-20 flex flex-col"
                >
                  <Clock className="w-5 h-5 mb-1" />
                  <span className="text-lg font-bold">{minutes}</span>
                  <span className="text-xs">minutes</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Or Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Custom Duration */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Custom Duration</h2>
            <div className="flex gap-3">
              <Input
                type="number"
                placeholder="Enter minutes"
                value={customMinutes}
                onChange={(e) => {
                  setCustomMinutes(e.target.value);
                  setSelectedMinutes(null);
                }}
                className="text-lg"
                min="1"
                max="300"
              />
              <span className="flex items-center text-muted-foreground">minutes</span>
            </div>
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStart}
            disabled={!(selectedMinutes || (customMinutes && parseInt(customMinutes) > 0))}
            className="w-full h-14 text-lg"
            size="lg"
          >
            Start Focus Session →
          </Button>

          {/* Info */}
          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>⏱️ Choose your focus duration</p>
            <p>👁️ Camera and screen monitoring will be activated</p>
          </div>
        </Card>
      </div>

      {/* Screen Share Request Dialog */}
      <Dialog open={showScreenDialog} onOpenChange={setShowScreenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <Monitor className="h-12 w-12 text-blue-500" />
            </div>
            <DialogTitle className="text-center text-2xl">
              Share Your Entire Screen
            </DialogTitle>
            <DialogDescription className="text-center space-y-4">
              <p className="text-base">
                For accurate activity detection, we need access to your <strong>ENTIRE SCREEN</strong>.
              </p>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-left space-y-2">
                <p className="font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Important Instructions:
                </p>
                <ul className="text-sm space-y-1 text-yellow-800 dark:text-yellow-300">
                  <li>✅ Select "<strong>Entire Screen</strong>" or "<strong>Your Entire Screen</strong>"</li>
                  <li>❌ Do NOT select "Window" or "Tab"</li>
                  <li>🖥️ Choose your primary monitor</li>
                </ul>
              </div>

              {screenError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-600 dark:text-red-400 text-sm">
                  {screenError}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Button
              onClick={requestScreenShare}
              disabled={isRequestingScreen}
              size="lg"
              className="w-full"
            >
              {isRequestingScreen ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Requesting Screen...
                </>
              ) : (
                <>
                  <Monitor className="mr-2 h-4 w-4" />
                  Share Entire Screen
                </>
              )}
            </Button>

            <Button
              onClick={() => setShowScreenDialog(false)}
              variant="outline"
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TimeSelection;
