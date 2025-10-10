// Beep sound generator using Web Audio API
let audioContext: AudioContext | null = null;
let alarmIntervalId: number | null = null;
let isAlarmRunning: boolean = false;

export const playBeep = async (
  duration: number = 200,
  frequency: number = 800,
  volume: number = 50
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Create or reuse audio context
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Set frequency (higher = more urgent)
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      // Set volume (0-100)
      gainNode.gain.value = volume * 0.01;

      // Play beep
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration * 0.001);

      oscillator.onended = () => resolve();
    } catch (error) {
      console.error("Beep error:", error);
      reject(error);
    }
  });
};

// Continuous alarm that repeats until stopped
export const startContinuousAlarm = (
  frequency: number = 1200,
  beepDuration: number = 400,
  pauseDuration: number = 300
): void => {
  // Prevent multiple alarms
  if (isAlarmRunning) {
    console.log("⚠️ Alarm already running, skipping...");
    return;
  }

  // Stop any existing alarm first
  stopContinuousAlarm();
  
  isAlarmRunning = true;
  console.log("🚨 ALARM STARTED");

  const playAlarmCycle = async () => {
    // Check if alarm should still be running
    if (!isAlarmRunning) {
      console.log("🛑 Alarm stopped in cycle");
      return;
    }

    try {
      await playBeep(beepDuration, frequency, 70);
      
      // Schedule next beep after pause (only if still running)
      if (isAlarmRunning) {
        alarmIntervalId = window.setTimeout(playAlarmCycle, beepDuration + pauseDuration);
      }
    } catch (error) {
      console.error("Alarm error:", error);
    }
  };

  // Start the alarm cycle
  playAlarmCycle();
};

// Stop the continuous alarm
export const stopContinuousAlarm = (): void => {
  console.log("✅ STOPPING ALARM");
  
  isAlarmRunning = false;
  
  if (alarmIntervalId !== null) {
    clearTimeout(alarmIntervalId);
    alarmIntervalId = null;
  }
};

// Check if alarm is currently playing
export const isAlarmPlaying = (): boolean => {
  return isAlarmRunning;
};

// Different beep types
export const playSuccessBeep = () => playBeep(300, 600, 40);
export const playAlertBeep = () => playBeep(400, 1000, 60);
export const playWarningBeep = () => playBeep(200, 1200, 70);
