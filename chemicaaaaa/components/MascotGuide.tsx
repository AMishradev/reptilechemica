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

const cleanChatText = (text: string) =>
  text
    .replace(/\*\*/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, '$1$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

interface MascotChatEntry extends AgentverseChatMessage {
  id: string;
}

const createChatId = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const MascotGuide: React.FC<MascotGuideProps> = ({ message, isDashboardOpen, trackingData, combinedElement, advice }) => {
  const [mascotText, setMascotText] = useState("Welcome to the design lab. Pick two components.");
  const [isVisible, setIsVisible] = useState(true);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<MascotChatEntry[]>([
    {
      id: 'intro',
      role: 'assistant',
      content: 'Atomis online. Ask me about networking or system design.',
    },
  ]);
  
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
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

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

  const sendChatMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const content = chatInput.trim();
    if (!content || isChatLoading) return;

    const userMessage: MascotChatEntry = {
      id: createChatId(),
      role: 'user',
      content,
    };
    const nextMessages = [...chatMessages, userMessage];
    const messagesForAgent = nextMessages
      .filter(item => item.id !== 'intro')
      .map(({ role, content }) => ({ role, content }));

    setChatMessages(nextMessages);
    setChatInput('');
    setIsChatLoading(true);
    setMascotText('Thinking through the system shape...');
    lastUpdateRef.current = Date.now();

    try {
      const reply = cleanChatText(await askAgentverseBrain(messagesForAgent));
      const assistantMessage: MascotChatEntry = {
        id: createChatId(),
        role: 'assistant',
        content: reply,
      };

      setChatMessages(current => [...current, assistantMessage]);
      setMascotText(reply.slice(0, 360));
      lastUpdateRef.current = Date.now();
    } catch (error) {
      console.error('Agentverse mascot chat failed:', error);
      const fallback = 'I cannot reach the Atomis brain yet. Check ASI_API_KEY, then restart the dev server.';
      setChatMessages(current => [
        ...current,
        {
          id: createChatId(),
          role: 'assistant',
          content: fallback,
        },
      ]);
      setMascotText(fallback);
      lastUpdateRef.current = Date.now();
    } finally {
      setIsChatLoading(false);
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

  useEffect(() => {
    if (!isChatOpen) return;

    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [chatMessages, isChatLoading, isChatOpen]);

  const mascotMood = isChatLoading
    ? 'thinking'
    : getMascotMood(message, mascotText, combinedElement, isGeminiLoading);

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
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end pointer-events-none overflow-visible ">
       {isChatOpen ? (
        <div className="mb-3 w-[min(22rem,calc(100vw-2rem))] max-h-[min(30rem,calc(100vh-11rem))] pointer-events-auto rounded-2xl border border-cyan-400/35 bg-[#031014]/95 shadow-[0_0_32px_rgba(34,211,238,0.24)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-cyan-400/20 px-4 py-3">
            <div>
              <div className="font-['Space_Grotesk'] text-sm font-semibold tracking-normal text-cyan-100">Atomis</div>
              <div className="font-mono text-[10px] text-cyan-200/60">Agentverse brain</div>
            </div>
            <button
              type="button"
              aria-label="Close Atomis chat"
              onClick={() => setIsChatOpen(false)}
              className="h-8 w-8 rounded-full border border-white/10 bg-white/5 font-mono text-sm text-cyan-100 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            >
              x
            </button>
          </div>

          <div ref={chatScrollRef} className="atomis-chat-scroll max-h-80 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.map(item => (
              <div
                key={item.id}
                className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 font-mono text-xs leading-relaxed ${
                    item.role === 'user'
                      ? 'rounded-br-sm bg-cyan-300 text-black'
                      : 'rounded-bl-sm border border-cyan-400/20 bg-white/10 text-cyan-50'
                  }`}
                >
                  {item.content}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-cyan-400/20 bg-white/10 px-3 py-2 font-mono text-xs text-cyan-100">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={sendChatMessage} className="flex gap-2 border-t border-cyan-400/20 p-3">
            <input
              value={chatInput}
              onChange={event => setChatInput(event.target.value)}
              disabled={isChatLoading}
              placeholder="Ask about the lab"
              className="min-w-0 flex-1 rounded-xl border border-cyan-400/25 bg-black/45 px-3 py-2 font-mono text-xs text-cyan-50 placeholder:text-cyan-100/35 outline-none transition-colors focus:border-cyan-300"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading}
              className="rounded-xl border border-cyan-300/50 bg-cyan-300 px-3 py-2 font-mono text-xs font-semibold text-black transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/35"
            >
              Send
            </button>
          </form>
        </div>
       ) : (
       <div className="mb-2 max-w-xs bg-white/10 backdrop-blur-md border border-cyan-500/30 p-4 rounded-t-2xl rounded-bl-2xl rounded-br-none text-right shadow-[0_0_20px_rgba(34,211,238,0.2)] animate-bounce-slight origin-bottom-right transform transition-all">
          <p className="text-cyan-100 font-mono text-sm leading-relaxed">
            {mascotText}
          </p>
       </div>
       )}

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
