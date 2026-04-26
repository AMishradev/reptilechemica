import React, { useEffect, useState, useRef } from 'react';
import MascotAvatar, { type MascotMood } from './MascotAvatar';
import { getSystemMessage } from '../utils/mascot';
import { getElementExplanation } from '../utils/gemini';
import { askAgentverseBrain, type AgentverseChatMessage } from '../utils/agentverseChat';
import { TrackingData, ElementData } from '../types';

interface MascotGuideProps {
  message: string; // System message from App
  isDashboardOpen: boolean;
  trackingData: React.MutableRefObject<TrackingData>;
  combinedElement: ElementData | null; // New component that was just created
  advice?: string | null;
}

const getMascotMood = (
  message: string,
  mascotText: string,
  combinedElement: ElementData | null,
  isGeminiLoading: boolean
): MascotMood => {
  const combinedSymbol = combinedElement?.symbol;
  const combinedText = `${message} ${mascotText}`.toUpperCase();

  if (combinedText.match(/BOOM|ERROR|FAILED|INVALID|TRY AGAIN|NO MATCH|COLLISION/)) {
    return 'alert';
  }

  if (combinedElement && combinedSymbol !== 'BOOM' && combinedSymbol !== 'X') {
    return 'success';
  }

  if (isGeminiLoading || combinedText.match(/OBSERVING|INITIALIZING|ANALYZING|GENERATING|LOADING/)) {
    return 'thinking';
  }

  return 'idle';
};

const getSpeakableMascotText = (text: string) =>
  text
    .replace(/::|\/\/|->|→/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 360);

const getPerformedMascotText = (text: string, mood: MascotMood, message: string) => {
  const context = `${message} ${text}`.toUpperCase();

  if (mood === 'success') return `[happily] ${text}`;
  if (mood === 'alert' || context.match(/UNSTABLE|WARNING|FAILED|INCOMPATIBLE|TRY AGAIN|NO MATCH/)) {
    return `[concerned] ${text}`;
  }
  if (mood === 'thinking' || context.match(/OBSERVING|ANALYZING|INITIALIZING|GENERATING|LOADING/)) {
    return `[curious] ${text}`;
  }
  if (context.match(/READY|PICK TWO|NEXT DESIGN|WELCOME/)) return `[warmly] ${text}`;

  return `[curious] ${text}`;
};

const MascotGuide: React.FC<MascotGuideProps> = ({ message, isDashboardOpen, trackingData, combinedElement, advice }) => {
  const [mascotText, setMascotText] = useState("Welcome to the design lab. Pick two components.");
  const [isVisible, setIsVisible] = useState(true);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  
  // Track the current Gemini explanation
  const [geminiExplanation, setGeminiExplanation] = useState<string | null>(null);
  const [explanationStartTime, setExplanationStartTime] = useState<number | null>(null);
  const lastCombinedElementRef = useRef<string | null>(null);
  const geminiLoadingRef = useRef(false);

  // Track when the current text was actually displayed
  const lastUpdateRef = useRef<number>(Date.now());
  // Track the timeout to allow cleanup
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechUrlRef = useRef<string | null>(null);
  const lastSpokenTextRef = useRef<string>('');

  const stopMascotSpeech = () => {
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;

    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current = null;
    }

    if (speechUrlRef.current) {
      URL.revokeObjectURL(speechUrlRef.current);
      speechUrlRef.current = null;
    }

    window.speechSynthesis?.cancel();
  };

  const speakWithBrowserVoice = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice =>
      /aria|jenny|samantha|google us english|english/i.test(voice.name)
    ) ?? voices.find(voice => voice.lang.toLowerCase().startsWith('en'));

    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.pitch = 1.16;
    utterance.rate = 1.02;
    utterance.volume = 0.86;
    window.speechSynthesis.speak(utterance);
  };

  const speakMascotText = async (text: string, performedText: string) => {
    stopMascotSpeech();

    const controller = new AbortController();
    speechAbortRef.current = controller;

    try {
      const response = await fetch('/api/mascot-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: performedText }),
        signal: controller.signal,
      });
      const contentType = response.headers.get('Content-Type') ?? '';

      if (!response.ok || !contentType.includes('audio')) {
        throw new Error('Mascot speech endpoint unavailable');
      }

      const audioBlob = await response.blob();
      if (controller.signal.aborted) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.volume = 0.86;
      speechUrlRef.current = audioUrl;
      speechAudioRef.current = audio;

      audio.addEventListener('ended', () => {
        if (speechUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          speechUrlRef.current = null;
          speechAudioRef.current = null;
        }
      });

      await audio.play();
    } catch {
      if (!controller.signal.aborted) {
        speakWithBrowserVoice(text);
      }
    }
  };

  // Handle new component creation - call Gemini API
  useEffect(() => {
    // Only trigger when a new component is successfully created (not errors like BOOM or X)
    if (combinedElement && 
        combinedElement.symbol !== 'BOOM' && 
        combinedElement.symbol !== 'X' &&
        combinedElement.symbol !== lastCombinedElementRef.current &&
        (message.includes('FUSION SUCCESS') || message.includes('QUIZ SUCCESS'))) {
      
      // If we have a previous explanation, ensure it was shown for at least 8 seconds
      if (geminiExplanation && explanationStartTime) {
        const timeShown = Date.now() - explanationStartTime;
        const minDisplayTime = 8000; // 8 seconds minimum
        
        if (timeShown < minDisplayTime) {
          // Wait until minimum time is reached before loading new explanation
          const remainingTime = minDisplayTime - timeShown;
          setTimeout(() => {
            // Now load the new explanation
            geminiLoadingRef.current = true;
            setIsGeminiLoading(true);
            lastCombinedElementRef.current = combinedElement.symbol;
             
            getElementExplanation(combinedElement).then((explanation) => {
              setGeminiExplanation(explanation);
              setExplanationStartTime(Date.now());
              geminiLoadingRef.current = false;
              setIsGeminiLoading(false);
            }).catch((error) => {
              console.error('Failed to get Gemini explanation:', error);
              geminiLoadingRef.current = false;
              setIsGeminiLoading(false);
              setGeminiExplanation(`Nice! You've created ${combinedElement.name}. This composed component adds a new capability to the system.`);
              setExplanationStartTime(Date.now());
            });
          }, remainingTime);
          return;
        }
      }
      
      // Mark that we're loading a new explanation
      geminiLoadingRef.current = true;
      setIsGeminiLoading(true);
      lastCombinedElementRef.current = combinedElement.symbol;
       
      // Call Gemini API to get explanation
      getElementExplanation(combinedElement).then((explanation) => {
        setGeminiExplanation(explanation);
        setExplanationStartTime(Date.now());
        geminiLoadingRef.current = false;
        setIsGeminiLoading(false);
      }).catch((error) => {
        console.error('Failed to get Gemini explanation:', error);
        geminiLoadingRef.current = false;
        setIsGeminiLoading(false);
        // Use fallback
        setGeminiExplanation(`Nice! You've created ${combinedElement.name}. This composed component adds a new capability to the system.`);
        setExplanationStartTime(Date.now());
      });
    }
    
    // Clear explanation when combinedElement is cleared (user resets/clears)
    // But ensure it was shown for at least 8 seconds
    if (!combinedElement && geminiExplanation && explanationStartTime) {
      const timeShown = Date.now() - explanationStartTime;
      const minDisplayTime = 8000; // 8 seconds minimum
      
      if (timeShown < minDisplayTime) {
        // Wait until minimum time is reached
        const timeoutId = setTimeout(() => {
          setGeminiExplanation(null);
          setExplanationStartTime(null);
          lastCombinedElementRef.current = null;
        }, minDisplayTime - timeShown);
        return () => clearTimeout(timeoutId);
      } else {
        setGeminiExplanation(null);
        setExplanationStartTime(null);
        lastCombinedElementRef.current = null;
      }
    }
  }, [combinedElement, message, geminiExplanation, explanationStartTime]);

  // Update text immediately when Gemini explanation is ready or changes
  useEffect(() => {
    if (geminiExplanation) {
      setMascotText(geminiExplanation);
      lastUpdateRef.current = Date.now();
      return; // Don't show system message when Gemini explanation is active
    }
  }, [geminiExplanation]);

  // Sync system message to mascot speech with smart timing
  // BUT: Don't show system message if we have an active Gemini explanation
  useEffect(() => {
    // If we have an active Gemini explanation, prioritize it over system messages
    if (geminiExplanation && explanationStartTime) {
      // Keep showing Gemini explanation as long as combinedElement exists
      // or until minimum 8 seconds have passed
      const timeShown = Date.now() - explanationStartTime;
      if (combinedElement || timeShown < 8000) {
        // Still showing combined element or haven't reached 8 seconds yet
        setMascotText(geminiExplanation);
        return;
      }
      // After 8 seconds and combinedElement is cleared, allow system messages
    }
    
    // Only show system messages if no active Gemini explanation
    if (!geminiExplanation) {
      const nextText = advice ?? getSystemMessage(message);
      const isIdle = message.includes("LAB READY");
      
      const scheduleUpdate = () => {
          const now = Date.now();
          // How long has the *current* message been visible?
          const timeVisible = now - lastUpdateRef.current;
          
          // Default reaction delay
          let delay = 500; 
          
          if (isIdle) {
              // If switching back to Idle, ensure the previous message 
              // was shown for at least 3 seconds.
              const minDuration = 3000;
              if (timeVisible < minDuration) {
                  delay = minDuration - timeVisible;
              }
          }
          
          // Clear previous pending update
          if (timeoutRef.current) clearTimeout(timeoutRef.current);

          timeoutRef.current = setTimeout(() => {
              setMascotText(nextText);
              lastUpdateRef.current = Date.now(); // Reset timer upon actual update
          }, delay);
      };

      scheduleUpdate();

      return () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [message, advice, geminiExplanation, explanationStartTime, combinedElement]);

  // Hide mascot when dashboard is open (since dashboard has its own)
  useEffect(() => {
    setIsVisible(!isDashboardOpen);
  }, [isDashboardOpen]);

  const mascotMood = getMascotMood(message, mascotText, combinedElement, isGeminiLoading);

  useEffect(() => {
    if (!isVisible) {
      stopMascotSpeech();
      return;
    }

    const speakableText = getSpeakableMascotText(mascotText);
    if (!speakableText || speakableText === lastSpokenTextRef.current) return;

    const timeoutId = setTimeout(() => {
      lastSpokenTextRef.current = speakableText;
      const performedText = getPerformedMascotText(speakableText, mascotMood, message);
      void speakMascotText(speakableText, performedText);
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [mascotText, isVisible, mascotMood, message]);

  useEffect(() => () => stopMascotSpeech(), []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none overflow-visible ">
       {/* Speech Bubble */}
       <div className="mb-2 max-w-xs bg-white/10 backdrop-blur-md border border-cyan-500/30 p-4 rounded-t-2xl rounded-bl-2xl rounded-br-none text-right shadow-[0_0_20px_rgba(34,211,238,0.2)] animate-bounce-slight origin-bottom-right transform transition-all">
          <p className="text-cyan-100 font-mono text-sm leading-relaxed">
            {mascotText}
          </p>
       </div>

       {/* 3D Avatar Container */}
       <div className="w-40 h-40 relative group pointer-events-auto overflow-visible">
          {/* Glow Effect */}
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-3xl group-hover:bg-cyan-500/40 transition-all duration-500"></div>
          
           {/* Container */}
           <div className="w-full h-full relative z-10 pointer-events-auto">
              <MascotAvatar trackingData={trackingData} mood={mascotMood} />
           </div>
        </div>

       <style>{`
         @keyframes bounce-slight {
           0%, 100% { transform: translateY(0); }
           50% { transform: translateY(-5px); }
         }
         .animate-bounce-slight {
           animation: bounce-slight 3s ease-in-out infinite;
         }
       `}</style>
    </div>
  );
};

export default MascotGuide;
