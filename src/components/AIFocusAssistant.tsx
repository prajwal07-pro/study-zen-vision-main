import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { toast } from "sonner";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

const AIFocusAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hi! 👋 I'm your AI focus assistant. Click the microphone to ask me anything, or type your question!",
      sender: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

  // Initialize Speech Recognition and Synthesis
  useEffect(() => {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    if (!('speechSynthesis' in window)) {
      toast.error("Speech synthesis not supported in this browser");
      return;
    }

    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      console.log("🎤 Voice recognition started");
      setIsListening(true);
    };

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log("📝 Transcript:", transcript);
      setInputValue(transcript);
      setIsListening(false);
      // Auto-send after recognition
      handleSendMessage(transcript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      toast.error(`Voice recognition error: ${event.error}`);
    };

    recognitionRef.current.onend = () => {
      console.log("🛑 Voice recognition ended");
      setIsListening(false);
    };

    // Initialize Speech Synthesis
    synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Voice Input - Start/Stop Recording
  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        toast.success("🎤 Listening... Speak now!");
      } catch (error) {
        console.error("Recognition start error:", error);
        toast.error("Could not start voice recognition");
      }
    }
  };

  // Text to Speech - Speak the response
  const speakText = (text: string) => {
    if (!synthRef.current) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; // Speed (0.1 to 10)
    utterance.pitch = 1.0; // Pitch (0 to 2)
    utterance.volume = 1.0; // Volume (0 to 1)
    utterance.lang = 'en-US';

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log("🔊 Speaking...");
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      console.log("✅ Finished speaking");
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      console.error("Speech synthesis error:", event);
    };

    synthRef.current.speak(utterance);
  };

  // Stop speaking
  const stopSpeaking = () => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  };

  const generateResponse = async (userInput: string): Promise<string> => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const systemPrompt = `You are a helpful AI focus assistant for students. 
Keep responses very brief (2-3 sentences max). Be encouraging and supportive.
Help with: focus techniques, study tips, breaks, motivation.`;

      const prompt = `${systemPrompt}\n\nUser: ${userInput}\n\nAssistant:`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini error:", error);
      return getFallbackResponse(userInput);
    }
  };

  const getFallbackResponse = (message: string): string => {
    const input = message.toLowerCase();
    
    if (input.includes("break")) {
      return "Taking a 5-minute break is a great idea! Walk around, stretch, or grab some water.";
    } else if (input.includes("focus") || input.includes("concentrate")) {
      return "Try the Pomodoro Technique: 25 minutes focused work, 5-minute break. It really helps!";
    } else if (input.includes("tired") || input.includes("exhausted")) {
      return "Feeling tired? Take a 15-minute walk or drink water. Dehydration causes fatigue!";
    } else if (input.includes("motivat")) {
      return "You're doing amazing! Progress, not perfection. Every small step counts!";
    } else {
      return "I'm here to support you! Need study tips, breaks, or motivation? Just ask!";
    }
  };

  const handleSendMessage = async (textOverride?: string) => {
    const messageText = textOverride || inputValue;
    
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const assistantResponse = await generateResponse(messageText);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: assistantResponse,
        sender: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Auto-speak the response
      if (autoSpeak) {
        speakText(assistantResponse);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm here to help! Try asking about focus, breaks, or study tips.",
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white/5 rounded-lg border border-white/10">
      {/* Header with Controls */}
      <div className="p-3 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-purple-300" />
          <span className="text-sm font-semibold text-purple-200">AI Assistant</span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoSpeak(!autoSpeak)}
          className="text-purple-300 hover:text-purple-100"
        >
          {autoSpeak ? (
            <>
              <Volume2 className="h-4 w-4 mr-1" />
              <span className="text-xs">Auto-speak ON</span>
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4 mr-1" />
              <span className="text-xs">Auto-speak OFF</span>
            </>
          )}
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.sender === "user"
                    ? "bg-purple-500 text-white"
                    : "bg-white/10 text-white backdrop-blur-sm"
                }`}
              >
                {message.sender === "assistant" && (
                  <Bot className="h-4 w-4 inline mr-2" />
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input with Voice Control */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2 mb-2">
          {/* Voice Input Button */}
          <Button
            onClick={toggleVoiceInput}
            disabled={isLoading}
            size="icon"
            className={`${
              isListening 
                ? "bg-red-500 hover:bg-red-600 animate-pulse" 
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {isListening ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          {/* Text Input */}
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isListening ? "Listening..." : "Type or speak your question..."}
            disabled={isLoading || isListening}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />

          {/* Send Button */}
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="bg-purple-500 hover:bg-purple-600"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>

          {/* Stop Speaking Button */}
          {isSpeaking && (
            <Button
              onClick={stopSpeaking}
              size="icon"
              variant="destructive"
              className="animate-pulse"
            >
              <VolumeX className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>
            {isListening ? "🎤 Listening..." : "💡 Click mic to speak"}
          </span>
          {isSpeaking && (
            <span className="text-green-400 animate-pulse">🔊 Speaking...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIFocusAssistant;
