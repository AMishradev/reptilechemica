
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Scene from './components/Scene';
import HandTracker from './components/HandTracker';
import UIOverlay from './components/UIOverlay';
import Dashboard from './components/Dashboard';
import MascotGuide from './components/MascotGuide';
import { ELEMENTS, COMBINATIONS } from './constants';
import { TrackingData, ElementData, GameState, SpotifyBuildState } from './types';
import successChime from './assets/sounds/success-chime.mp3';
import softError from './assets/sounds/soft-error.mp3';

const createIdleTrackingData = (cameraAspect = 1.77): TrackingData => ({
  left: {
    pinchDistance: 0.5,
    isPinching: false,
    isPointing: false,
    position: { x: 0, y: 0, z: 0 },
    indexPosition: { x: 0, y: 0, z: 0 },
    isDetected: false,
    isPresent: false,
  },
  right: {
    pinchDistance: 0.5,
    isPinching: false,
    isPointing: false,
    position: { x: 0, y: 0, z: 0 },
    indexPosition: { x: 0, y: 0, z: 0 },
    isDetected: false,
    isPresent: false,
  },
  isSnapReady: false,
  isResetGesture: false,
  isClosedFist: false,
  isSixtySevenGesture: false,
  handDistance: 1000,
  cameraAspect,
});

const getPairKey = (leftSymbol: string, rightSymbol: string) =>
  [leftSymbol, rightSymbol].sort().join('+');

const formatAdviceList = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
};

const getPossibleOutcomes = (symbol: string) => {
  const outcomes = COMBINATIONS
    .filter(combination => combination.elements.includes(symbol))
    .map(combination => {
      const partner = combination.elements.find(item => item !== symbol) ?? symbol;
      return `${partner} for ${combination.result.symbol}`;
    });

  return Array.from(new Set(outcomes));
};

const getRepeatedFailureAdvice = (leftSymbol: string, rightSymbol: string) => {
  const leftOutcomes = getPossibleOutcomes(leftSymbol);
  const rightOutcomes = getPossibleOutcomes(rightSymbol);

  const leftAdvice = leftOutcomes.length
    ? `For ${leftSymbol}, try ${formatAdviceList(leftOutcomes)}`
    : `${leftSymbol} has no known stable pairing yet`;
  const rightAdvice = rightOutcomes.length
    ? `For ${rightSymbol}, try ${formatAdviceList(rightOutcomes)}`
    : `${rightSymbol} has no known stable pairing yet`;

  return `${leftAdvice}. ${rightAdvice}.`;
};

const SPOTIFY_BASE_SYMBOLS = ['CLIENT', 'DNS', 'CDN', 'LB', 'API', 'APP', 'DB', 'CACHE', 'QUEUE', 'OBJ'];
const SPOTIFY_RELEVANT_SYMBOLS = [
  'EDGE',
  'CONTENT',
  'ROUTE',
  'SVC',
  'CRUD',
  'SCALE',
  'STATIC',
  'MEDIA',
  'FAST',
  'ASYNC',
  'READ',
  'JOBDB',
  'DATA',
  'WORKER',
];
const SPOTIFY_TARGET_PIECE_COUNT = 4;

const createInactiveSpotifyBuild = (): SpotifyBuildState => ({
  active: false,
  builtSymbols: [],
  targetPieceCount: SPOTIFY_TARGET_PIECE_COUNT,
});

const App: React.FC = () => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRetryKey, setCameraRetryKey] = useState(0);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const visualPreviewElement = useMemo(() => {
    if (!import.meta.env.DEV) return null;

    const symbol = new URLSearchParams(window.location.search).get('visual')?.toUpperCase();
    if (!symbol) return null;

    return COMBINATIONS.find(combination => combination.result.symbol === symbol)?.result
      ?? ELEMENTS.find(element => element.symbol === symbol)
      ?? null;
  }, []);
  
  const [leftElement, setLeftElement] = useState<ElementData>(ELEMENTS[0]);
  const [rightElement, setRightElement] = useState<ElementData>(ELEMENTS[3]); 
  
  const [combinedElement, setCombinedElement] = useState<ElementData | null>(null);
  const [message, setMessage] = useState("LAB READY");
  const [mascotAdvice, setMascotAdvice] = useState<string | null>(null);
  const [savedElements, setSavedElements] = useState<ElementData[]>([]);
  
  const [gameState, setGameState] = useState<GameState>('playing');
  const [deathReason, setDeathReason] = useState<string>('');
  const [showSixtySeven, setShowSixtySeven] = useState(false);
  const sixtySevenGestureProcessedRef = useRef(false);
  const displayedCombinedElement = visualPreviewElement ?? combinedElement;
  const displayedMessage = visualPreviewElement
    ? `VISUAL MAPPING: ${visualPreviewElement.name.toUpperCase()}`
    : message;
  const shouldShowLab = isCameraReady || Boolean(visualPreviewElement);
  
  // Quiz Mode State
  const [quizMode, setQuizMode] = useState<{
    active: boolean;
    difficulty: 'easy' | 'medium' | null;
    targetSymbol: string | null;
    targetName: string | null;
  }>({ active: false, difficulty: null, targetSymbol: null, targetName: null });
  const [spotifyBuild, setSpotifyBuild] = useState<SpotifyBuildState>(createInactiveSpotifyBuild);
  const activeSpotifyBuild = spotifyBuild.active ? spotifyBuild : null;

  // Fallback to prevent infinite loading if camera fails to init
  useEffect(() => {
    const t = setTimeout(() => {
        if (!isCameraReady) {
            console.warn("Camera init timeout - Forcing app start");
            setIsCameraReady(true);
        }
    }, 10000);
    return () => clearTimeout(t);
  }, [isCameraReady]);

  const [labSlots, setLabSlots] = useState<ElementData[]>([]); // Dashboard slots (8 manually selected)
  const [labCreatedSlots, setLabCreatedSlots] = useState<ElementData[]>([]); // Lab-created slots (8 auto-discovered)

  // Load saved history and lab slots on mount
  useEffect(() => {
    const validCreatedSymbols = new Set(COMBINATIONS.map(c => c.result.symbol));
    const validBaseSymbols = new Set(ELEMENTS.map(e => e.symbol));
    const validSymbols = new Set([...validBaseSymbols, ...validCreatedSymbols]);

    const history = JSON.parse(localStorage.getItem('chemLabHistory') || '[]')
      .filter((item: ElementData) => validSymbols.has(item.symbol));
    setSavedElements(history);
    localStorage.setItem('chemLabHistory', JSON.stringify(history));
    
    // Load dashboard slots (manually selected)
    const savedSlots = localStorage.getItem('labSlots');
    if (savedSlots) {
      try {
        const parsed = JSON.parse(savedSlots)
          .filter((item: ElementData) => validSymbols.has(item.symbol));
        setLabSlots(parsed);
        localStorage.setItem('labSlots', JSON.stringify(parsed));
        // Set initial elements from slots if available
        if (parsed.length > 0) {
          setLeftElement(parsed[0]);
          if (parsed.length > 1) {
            setRightElement(parsed[1]);
          }
        }
      } catch (e) {
        console.error('Failed to parse saved slots', e);
      }
    }
    
    // Load lab-created slots (auto-discovered in lab)
    const savedCreatedSlots = localStorage.getItem('labCreatedSlots');
    if (savedCreatedSlots) {
      try {
        const parsed = JSON.parse(savedCreatedSlots)
          .filter((item: ElementData) => validCreatedSymbols.has(item.symbol));
        setLabCreatedSlots(parsed);
        localStorage.setItem('labCreatedSlots', JSON.stringify(parsed));
      } catch (e) {
        console.error('Failed to parse lab created slots', e);
      }
    }
  }, []);

  // Design Warning System
  useEffect(() => {
    if (gameState === 'dead') return;
    if (quizMode.active || spotifyBuild.active) return; // Disable warnings in guided modes
    
    const symbols = [leftElement.symbol, rightElement.symbol];
    const hasClient = symbols.includes('CLIENT');
    const hasDatabase = symbols.includes('DB');
    
    if (hasClient && hasDatabase) {
       if (!message.includes("WARNING")) {
           setMessage("WARNING: Clients should not talk directly to databases.");
       }
    }
  }, [leftElement, rightElement, gameState, message, quizMode.active, spotifyBuild.active]);

  const saveElement = (element: ElementData) => {
      const history = JSON.parse(localStorage.getItem('chemLabHistory') || '[]');
      if (!history.find((e: ElementData) => e.symbol === element.symbol)) {
          const newHistory = [element, ...history];
          localStorage.setItem('chemLabHistory', JSON.stringify(newHistory));
          setSavedElements(newHistory);
      }
      
      // Automatically add to lab-created slots (separate from dashboard slots)
      // Only if element is not already in dashboard slots or lab-created slots
      setLabCreatedSlots(prevCreatedSlots => {
          // Check if element is already in dashboard slots (read from localStorage for current state)
          const currentDashboardSlots = JSON.parse(localStorage.getItem('labSlots') || '[]');
          if (currentDashboardSlots.find((e: ElementData) => e.symbol === element.symbol)) {
              return prevCreatedSlots; // Already in dashboard slots, don't add to created slots
          }
          
          // Check if element is already in lab-created slots
          if (prevCreatedSlots.find(e => e.symbol === element.symbol)) {
              return prevCreatedSlots; // Already in created slots, no change
          }
          
          // Check if lab-created slots are full (max 4)
          if (prevCreatedSlots.length >= 4) {
              return prevCreatedSlots; // Slots full, can't add
          }
          
          // Add to lab-created slots
          const newCreatedSlots = [...prevCreatedSlots, element];
          localStorage.setItem('labCreatedSlots', JSON.stringify(newCreatedSlots));
          return newCreatedSlots;
      });
  };

  const startQuiz = useCallback((difficulty: 'easy' | 'medium') => {
      let target = '';
      let targetName = '';

      if (difficulty === 'easy') {
          target = 'FAST';
          targetName = 'Cached Service';
      } else {
          target = 'SCALE';
          targetName = 'Scalable Service';
      }

      const trainingSymbols = difficulty === 'easy'
          ? ['APP', 'CACHE', 'API', 'DB', 'LB', 'CLIENT', 'DNS', 'CDN']
          : ['APP', 'CACHE', 'QUEUE', 'DB', 'API', 'LB', 'CLIENT', 'DNS'];

      // Keep training modules bounded to the slot count while ensuring required components are present.
      const slots = trainingSymbols
          .map(symbol => ELEMENTS.find(e => e.symbol === symbol))
          .filter((item): item is ElementData => Boolean(item))
          .sort(() => Math.random() - 0.5);

      setLabSlots(slots);
      // Reset active components to first available (now randomized)
      if (slots.length > 0) {
        setLeftElement(slots[0]);
        setRightElement(slots[1] || slots[0]);
      }
      
	      setQuizMode({ active: true, difficulty, targetSymbol: target, targetName });
	      setSpotifyBuild(createInactiveSpotifyBuild());
	      setIsDashboardOpen(false);
      setMessage(`QUIZ: CREATE ${targetName.toUpperCase()}`);
      // Clear any previous lab created slots
      setLabCreatedSlots([]);
  }, []);

  // Error State Ref (for update loop access)
  const fusionErrorRef = useRef(false);
  const lastInteractionTime = useRef(0);

  const trackingDataRef = useRef<TrackingData>(createIdleTrackingData());

  const lastLeftHoverRef = useRef<string | null>(null);
  const lastRightHoverRef = useRef<string | null>(null);
  const lastLeftPinchingRef = useRef(false);
  const lastRightPinchingRef = useRef(false);
  const failedFusionAttemptsRef = useRef<Record<string, number>>({});
  const preSpotifyLabSlotsRef = useRef<ElementData[] | null>(null);

  const snapFuseArmedRef = useRef(true);

  const handleCameraReady = useCallback(() => {
    setCameraError(null);
    setIsCameraReady(true);
  }, []);

  const handleCameraError = useCallback((message: string) => {
    trackingDataRef.current = createIdleTrackingData(trackingDataRef.current.cameraAspect);
    setCameraError(message);
    setIsCameraReady(true);
  }, []);

  const retryCamera = useCallback(() => {
    setCameraError(null);
    setCameraRetryKey(key => key + 1);
  }, []);

  useEffect(() => {
    if (!isDashboardOpen) return;

    trackingDataRef.current = createIdleTrackingData(trackingDataRef.current.cameraAspect);
    lastLeftHoverRef.current = null;
    lastRightHoverRef.current = null;
    lastLeftPinchingRef.current = false;
    lastRightPinchingRef.current = false;
    snapFuseArmedRef.current = true;
  }, [isDashboardOpen]);

  const startSpotifyChallenge = useCallback(() => {
    const slots = SPOTIFY_BASE_SYMBOLS
      .map(symbol => ELEMENTS.find(element => element.symbol === symbol))
      .filter((item): item is ElementData => Boolean(item));

    preSpotifyLabSlotsRef.current = [...labSlots];
    setLabSlots(slots);
    setLabCreatedSlots([]);
    setCombinedElement(null);
    setQuizMode({ active: false, difficulty: null, targetSymbol: null, targetName: null });
    setSpotifyBuild({
      active: true,
      builtSymbols: [],
      targetPieceCount: SPOTIFY_TARGET_PIECE_COUNT,
    });
    setMascotAdvice("Snap useful components together and watch the Spotify system map light up.");
    fusionErrorRef.current = false;
    snapFuseArmedRef.current = true;

    if (slots.length > 0) {
      setLeftElement(slots[0]);
      setRightElement(slots[1] || slots[0]);
    }

    setIsDashboardOpen(false);
    setMessage("Design Spotify: assemble the streaming platform");
  }, [labSlots]);

  const returnFromSpotifyChallenge = useCallback((nextMessage = "LAB READY") => {
    if (preSpotifyLabSlotsRef.current) {
      setLabSlots(preSpotifyLabSlotsRef.current);
      localStorage.setItem('labSlots', JSON.stringify(preSpotifyLabSlotsRef.current));
      preSpotifyLabSlotsRef.current = null;
    }
    setSpotifyBuild(createInactiveSpotifyBuild());
    setCombinedElement(null);
    setLabCreatedSlots([]);
    setMascotAdvice(null);
    fusionErrorRef.current = false;
    snapFuseArmedRef.current = true;
    setIsDashboardOpen(true);
    setMessage(nextMessage);
  }, []);

  const undoSpotifyPiece = useCallback(() => {
    if (!spotifyBuild.active) return;

    const removedSymbol = spotifyBuild.builtSymbols[spotifyBuild.builtSymbols.length - 1];
    if (!removedSymbol) {
      setMessage("Design Spotify: nothing to undo yet");
      return;
    }

    setSpotifyBuild(prev => ({
      ...prev,
      builtSymbols: prev.builtSymbols.slice(0, -1),
    }));
    setLabCreatedSlots(prev => prev.filter(element => element.symbol !== removedSymbol));
    setCombinedElement(null);
    fusionErrorRef.current = false;
    snapFuseArmedRef.current = true;
    setMessage(`Design Spotify: removed ${removedSymbol}`);
  }, [spotifyBuild.active, spotifyBuild.builtSymbols]);

  const submitSpotifyDesign = useCallback(() => {
    if (!spotifyBuild.active) return;

    if (spotifyBuild.builtSymbols.length >= spotifyBuild.targetPieceCount) {
      setMessage("Spotify design passed. Returning...");
      setMascotAdvice("Solid draft: the map has enough working paths to represent a real streaming platform.");
      setTimeout(() => returnFromSpotifyChallenge("LAB READY"), 2500);
      return;
    }

    setMessage(`Spotify design failed. Add ${spotifyBuild.targetPieceCount - spotifyBuild.builtSymbols.length} more pieces`);
    setMascotAdvice("Add a few more working paths before submitting the design.");
    fusionErrorRef.current = true;
    setTimeout(() => returnFromSpotifyChallenge("LAB READY"), 2600);
  }, [returnFromSpotifyChallenge, spotifyBuild.active, spotifyBuild.builtSymbols, spotifyBuild.targetPieceCount]);

  const stopSpotifyChallenge = useCallback(() => {
    if (!spotifyBuild.active) return;
    returnFromSpotifyChallenge("LAB READY");
  }, [returnFromSpotifyChallenge, spotifyBuild.active]);

  useEffect(() => {
    if (!spotifyBuild.active) setMascotAdvice(null);
  }, [leftElement.symbol, rightElement.symbol, spotifyBuild.active]);

  const checkCombination = useCallback(() => {
    if (combinedElement || gameState === 'dead') return;
    
    const symbols = [leftElement.symbol, rightElement.symbol];

    const combo = COMBINATIONS.find(c => 
      (c.elements[0] === leftElement.symbol && c.elements[1] === rightElement.symbol) ||
      (c.elements[1] === leftElement.symbol && c.elements[0] === rightElement.symbol)
    );

	    if (combo) {
	        failedFusionAttemptsRef.current[getPairKey(leftElement.symbol, rightElement.symbol)] = 0;
	        setMascotAdvice(null);

	        if (spotifyBuild.active) {
	            const result = combo.result;
	            const isRelevant = SPOTIFY_RELEVANT_SYMBOLS.includes(result.symbol);
	            if (!isRelevant) {
	                setMessage(`${result.name} is stable, but not useful for Spotify`);
	                setMascotAdvice("For this challenge, focus on entry, content delivery, service routing, persistence, and scaling.");
	                fusionErrorRef.current = false;
	                return;
	            }

	            if (spotifyBuild.builtSymbols.includes(result.symbol)) {
	                setMessage(`Design Spotify: ${result.symbol} is already installed`);
	                setMascotAdvice("That piece is already part of the architecture. Try composing the next missing capability.");
	                fusionErrorRef.current = false;
	                return;
	            }

	            const nextBuiltSymbols = [...spotifyBuild.builtSymbols, result.symbol];
	            setSpotifyBuild(prev => ({
	                ...prev,
	                builtSymbols: prev.builtSymbols.includes(result.symbol)
	                  ? prev.builtSymbols
	                  : [...prev.builtSymbols, result.symbol],
	            }));
	            setLabCreatedSlots(prev => (
	                prev.some(element => element.symbol === result.symbol)
	                  ? prev
	                  : [...prev, result]
	            ));
	            setCombinedElement(result);
	            setMessage(`Spotify piece added: ${result.name}`);
	            setMascotAdvice(`Added ${result.name}. The map now has ${nextBuiltSymbols.length} assembled pieces.`);
	            fusionErrorRef.current = false;

	            setTimeout(() => {
	                setCombinedElement(current => current?.symbol === result.symbol ? null : current);
	                setMessage(`Design Spotify: ${nextBuiltSymbols.length} pieces assembled`);
	            }, 1200);
	            return;
	        }

	        // QUIZ LOGIC
	        if (quizMode.active && quizMode.targetSymbol) {
             // Check if result matches target
             if (combo.result.symbol === quizMode.targetSymbol) {
                 setCombinedElement(combo.result);
                 setMessage("QUIZ SUCCESS! RETURNING...");
                 fusionErrorRef.current = false;
                 
                 setTimeout(() => {
                     setCombinedElement(null);
                     setQuizMode({ active: false, difficulty: null, targetSymbol: null, targetName: null });
                     setIsDashboardOpen(true);
                     setMessage("LAB READY");
                 }, 3000);
                 return;
             }

             // Check if result is a valid intermediate step
             // Valid intermediates for SCALE: FAST, ASYNC
             const validIntermediates = quizMode.difficulty === 'medium' ? ['FAST', 'ASYNC'] : [];
             
             if (!validIntermediates.includes(combo.result.symbol)) {
                 // WRONG MIX
                 setCombinedElement(combo.result); 
                 setMessage("QUIZ FAILED! WRONG MIX");
                 fusionErrorRef.current = true;
                 
                 setTimeout(() => {
                     setCombinedElement(null);
                     setQuizMode({ active: false, difficulty: null, targetSymbol: null, targetName: null });
                     setIsDashboardOpen(true);
                     setMessage("LAB READY");
                 }, 3000);
                 return;
             }
        }

        setCombinedElement(combo.result);
        setMessage(`FUSION SUCCESS: ${combo.result.name}`);
        fusionErrorRef.current = false;
    } else {
      const pairKey = getPairKey(leftElement.symbol, rightElement.symbol);
      const attempts = (failedFusionAttemptsRef.current[pairKey] ?? 0) + 1;
      failedFusionAttemptsRef.current[pairKey] = attempts;
      setMascotAdvice(
        attempts === 1
          ? "That pairing is unstable. Try using a bridge component, like API, APP, or LB."
          : getRepeatedFailureAdvice(leftElement.symbol, rightElement.symbol)
      );

      // Quiz Failure for Incompatible Components
      if (quizMode.active) {
          setCombinedElement({
              symbol: 'X',
              name: 'Failed Quiz',
              color: '#ff0000',
              atomicNumber: 0,
              description: 'Incompatible Design'
          });
          setMessage("QUIZ FAILED! INCOMPATIBLE");
          fusionErrorRef.current = true;
          
          setTimeout(() => {
              setCombinedElement(null);
              setQuizMode({ active: false, difficulty: null, targetSymbol: null, targetName: null });
              setIsDashboardOpen(true);
              setMessage("LAB READY");
              fusionErrorRef.current = false;
          }, 3000);
          return;
      }

      setMessage("Design Unstable: Incompatible");
      fusionErrorRef.current = true; 
    }
	  }, [leftElement, rightElement, combinedElement, gameState, quizMode, spotifyBuild]);

  // Play success sound when components are successfully combined
  const prevCombinedElementRef = useRef<ElementData | null>(null);
  useEffect(() => {
    // Only play sound when combinedElement changes from null to a value (new combination)
	    if (combinedElement &&
	        !prevCombinedElementRef.current &&
	        combinedElement.symbol !== 'BOOM' &&
	        combinedElement.symbol !== 'X' &&
	        (message.includes('FUSION SUCCESS') || message.includes('QUIZ SUCCESS') || message.includes('Spotify piece added'))) {
      try {
        const audio = new Audio(successChime);
        audio.volume = 0.7;
        audio.play().catch(() => {
          // Ignore errors if audio fails to play
        });
      } catch (error) {
        // Ignore errors
      }
    }
    // Update ref to track previous value
    prevCombinedElementRef.current = combinedElement;
  }, [combinedElement, message]);

  // Play error sound when components cannot be composed
  const prevMessageRef = useRef<string>('');
  useEffect(() => {
    // Check if this is an error message
	    const isError = message.includes('Failed') ||
	                    message.includes('failed') ||
	                    message.includes('Incompatible') ||
	                    message.includes('QUIZ FAILED') ||
	                    message.includes('Design Unstable');
    
    // Check if this is a new error message (different from previous)
    const isNewError = isError && message !== prevMessageRef.current;
    
    // Don't play if it's a success message
	    const isSuccess = message.includes('FUSION SUCCESS') || message.includes('QUIZ SUCCESS') || message.includes('passed');
    
    // Play error sound for new error messages
    if (isNewError && !isSuccess) {
      try {
        const audio = new Audio(softError);
        audio.volume = 0.7;
        audio.play().catch(() => {
          // Ignore errors if audio fails to play
        });
      } catch (error) {
        // Ignore errors
      }
    }
    // Update ref to track previous message
    prevMessageRef.current = message;
  }, [message]);

  const performHitTest = (nx: number, ny: number, cameraAspect: number): HTMLElement | null => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const screenAspect = screenW / screenH;
    
    let screenX, screenY;

    if (screenAspect > cameraAspect) {
        const videoH_pixels = (1 / cameraAspect) * screenW;
        const offsetY = (videoH_pixels - screenH) / 2;
        screenX = nx * screenW;  
        screenY = ny * videoH_pixels - offsetY;
    } else {
        const videoW_pixels = cameraAspect * screenH;
        const offsetX = (videoW_pixels - screenW) / 2;
        screenX = nx * videoW_pixels - offsetX; 
        screenY = ny * screenH;
    }

    // Check all interactable controls.
    // Filtering based on mode (Dashboard vs Lab)
    const elements = document.querySelectorAll('.interactable-btn');
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const rect = el.getBoundingClientRect();
        
        // If Dashboard is OPEN, ignore non-dashboard items
        if (isDashboardOpen && !el.id.startsWith('dashboard-')) continue;
        
        // If Dashboard is CLOSED, ignore dashboard items
        if (!isDashboardOpen && el.id.startsWith('dashboard-')) continue;

        if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
            return el;
        }
    }
    return null;
  };

  const handleInteraction = useCallback((hit: HTMLElement, hand: 'LEFT' | 'RIGHT', isPinching: boolean = false, isPinchStart: boolean = false) => {
      // Only trigger on pinch/click, not just hover
      if (!isPinching && !hit.id.startsWith('shelf-item-')) {
          return; // For non-shelf items, require pinch to interact
      }

      const runThrottledAction = (action: () => void) => {
          const now = Date.now();
          if (now - lastInteractionTime.current < 650) return;
          lastInteractionTime.current = now;
          action();
      };

      if (hit.id === 'spotify-undo') {
          runThrottledAction(undoSpotifyPiece);
          return;
      }
      if (hit.id === 'spotify-submit') {
          runThrottledAction(submitSpotifyDesign);
          return;
      }
      if (hit.id === 'spotify-stop') {
          if (!isPinchStart) return;
          runThrottledAction(stopSpotifyChallenge);
          return;
      }

      // 1. Dashboard Logic
      if (hit.id === 'dashboard-toggle') {
          setIsDashboardOpen(true);
          setMessage("DASHBOARD OPENED");
          return;
      }
      if (hit.id === 'dashboard-close-btn') {
          setIsDashboardOpen(false);
          setMessage("LAB READY");
          return;
      }
      if (hit.id.startsWith('dashboard-')) {
          hit.click();
          return;
      }

      // 2. Shelf Logic - Allow hover selection for shelf items
      if (hit.id.startsWith('shelf-item-')) {
          const symbol = hit.dataset.symbol;

          // Check both dashboard slots and lab-created slots
          const selectedElement = labSlots.find(e => e.symbol === symbol)
            || labCreatedSlots.find(e => e.symbol === symbol);

          if (selectedElement) {
              lastInteractionTime.current = Date.now();
              if (hand === 'LEFT') {
                  setLeftElement(selectedElement);
                  setMessage("ELEMENT SWAPPED (LEFT)");
              } else {
                  setRightElement(selectedElement);
                  setMessage("ELEMENT SWAPPED (RIGHT)");
              }
              setTimeout(() => {
                  if (spotifyBuild.active) {
                      setMessage("Design Spotify: assemble the streaming platform");
                  } else if (quizMode.active && quizMode.targetName) {
                      setMessage(`QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`);
                  } else {
                      setMessage("LAB READY");
                  }
              }, 1000);
          }
      }
  }, [labSlots, labCreatedSlots, undoSpotifyPiece, submitSpotifyDesign, stopSpotifyChallenge, isDashboardOpen, quizMode, spotifyBuild.active]);

  const onTrackingUpdate = useCallback((data: TrackingData) => {
    if (isDashboardOpen) {
      trackingDataRef.current = createIdleTrackingData(data.cameraAspect);
      lastLeftPinchingRef.current = false;
      lastRightPinchingRef.current = false;
      return;
    }

    const leftPinchStarted = data.left.isPinching && !lastLeftPinchingRef.current;
    const rightPinchStarted = data.right.isPinching && !lastRightPinchingRef.current;
    const rememberPinchState = () => {
      lastLeftPinchingRef.current = data.left.isPinching;
      lastRightPinchingRef.current = data.right.isPinching;
    };

    trackingDataRef.current = data;
    
    // Handle 67 gesture detection - Easter egg: unlock Holmium
    // COMMENTED OUT - Disabled gesture detection
    /*
    if (data.isSixtySevenGesture && !sixtySevenGestureProcessedRef.current) {
      sixtySevenGestureProcessedRef.current = true;
      setShowSixtySeven(true);
      setTimeout(() => {
        setShowSixtySeven(false);
      }, 3000); // Show for 3 seconds
      
      // Check if Holmium is already unlocked
      const holmium = ELEMENTS.find(e => e.symbol === 'Ho');
      if (holmium) {
        const isAlreadyUnlocked = savedElements.some(e => e.symbol === 'Ho');
        if (!isAlreadyUnlocked) {
          // Unlock Holmium (add to saved elements)
          saveElement(holmium);
          setMessage("EASTER EGG DISCOVERED! NEW ELEMENT: HOLMIUM");
          setTimeout(() => {
            if (quizMode.active && quizMode.targetName) {
              setMessage(`QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`);
            } else {
              setMessage("LAB READY");
            }
          }, 4000);
        }
      }
      
      // Reset the flag after a delay to allow gesture detection again
      setTimeout(() => {
        sixtySevenGestureProcessedRef.current = false;
      }, 5000);
    } else if (!data.isSixtySevenGesture) {
      // Reset flag when gesture is no longer detected
      sixtySevenGestureProcessedRef.current = false;
    }
    */
    
    if (gameState === 'dead') {
      rememberPinchState();
      return;
    }

    if (data.isResetGesture || (data.isClosedFist && combinedElement)) {
      if (combinedElement) {
        if (!quizMode.active && !spotifyBuild.active) {
          saveElement(combinedElement);
          setMessage("ELEMENT SAVED TO SHELF");
          setTimeout(() => setMessage("LAB READY"), 2000);
        }
        setCombinedElement(null);
        fusionErrorRef.current = false;
        snapFuseArmedRef.current = false;
      } else if (data.isResetGesture) {
        if (fusionErrorRef.current || combinedElement) {
          setCombinedElement(null);
          fusionErrorRef.current = false;
          snapFuseArmedRef.current = true;
          if (spotifyBuild.active) {
            setMessage("Design Spotify: assemble the streaming platform");
          } else if (quizMode.active && quizMode.targetName) {
            setMessage(`QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`);
          } else {
            setMessage("LAB READY");
          }
        }
      }
      rememberPinchState();
      return;
    }

    if (fusionErrorRef.current) {
      if (!data.isSnapReady && data.handDistance > 0.25) {
        fusionErrorRef.current = false;
        snapFuseArmedRef.current = true;
        if (spotifyBuild.active) {
          setMessage("Design Spotify: assemble the streaming platform");
        } else if (quizMode.active && quizMode.targetName) {
          setMessage(`QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`);
        } else {
          setMessage("LAB READY");
        }
      }
      rememberPinchState();
      return;
    }

    if (!combinedElement && !fusionErrorRef.current) {
      // Only hit test if the hand is present
      if (data.left.isPresent) {
        const leftHit = performHitTest(data.left.indexPosition.x, data.left.indexPosition.y, data.cameraAspect);
        if (leftHit) {
          if (leftHit.id !== lastLeftHoverRef.current || data.left.isPinching) {
            handleInteraction(leftHit, 'LEFT', data.left.isPinching, leftPinchStarted);
            lastLeftHoverRef.current = leftHit.id;
          }
        } else {
          lastLeftHoverRef.current = null;
        }
      } else {
        // Reset hover state if hand lost
        lastLeftHoverRef.current = null;
      }
        
      if (data.right.isPresent) {
        const rightHit = performHitTest(data.right.indexPosition.x, data.right.indexPosition.y, data.cameraAspect);
        if (rightHit) {
          if (rightHit.id !== lastRightHoverRef.current || data.right.isPinching) {
            handleInteraction(rightHit, 'RIGHT', data.right.isPinching, rightPinchStarted);
            lastRightHoverRef.current = rightHit.id;
          }
        } else {
          lastRightHoverRef.current = null;
        }
      } else {
        lastRightHoverRef.current = null;
      }
    }

    if (!combinedElement && data.isSnapReady && !fusionErrorRef.current && snapFuseArmedRef.current) {
        snapFuseArmedRef.current = false;
        checkCombination();
    }

    if (!data.isSnapReady) {
      snapFuseArmedRef.current = true;
    }

    rememberPinchState();
  }, [combinedElement, checkCombination, handleInteraction, isDashboardOpen, quizMode, spotifyBuild.active]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      {!visualPreviewElement && !isDashboardOpen && !cameraError && (
        <HandTracker
          key={cameraRetryKey}
          onUpdate={onTrackingUpdate}
          onCameraReady={handleCameraReady}
          onCameraError={handleCameraError}
        />
      )}
      
      {!shouldShowLab && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-white">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="font-['Space_Grotesk'] text-xl font-semibold animate-pulse tracking-normal text-cyan-500">Initializing lab</p>
          </div>
        </div>
      )}

      {cameraError && !visualPreviewElement && !isDashboardOpen && (
        <div className="absolute top-6 left-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2 pointer-events-auto">
          <div className="border border-amber-300/40 bg-black/80 backdrop-blur-md shadow-[0_0_24px_rgba(251,191,36,0.18)] px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-['Space_Grotesk'] text-sm font-semibold tracking-normal text-amber-100">Camera blocked</p>
                <p className="font-mono text-xs text-amber-100/75">{cameraError}</p>
              </div>
              <button
                type="button"
                onClick={retryCamera}
                className="shrink-0 border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 font-mono text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

	      {shouldShowLab && (
	        <>
	          {!isDashboardOpen && (
	            <>
	              <Scene
	                  leftElement={leftElement}
	                  rightElement={rightElement}
	                  combinedElement={displayedCombinedElement}
	                  trackingData={trackingDataRef}
	                  spotifyBuild={activeSpotifyBuild}
	              />
	              <UIOverlay
	                  leftElement={leftElement}
	                  rightElement={rightElement}
	                  combinedElement={displayedCombinedElement}
	                  message={displayedMessage}
	                  trackingRef={trackingDataRef}
	                  labSlots={labSlots}
	                  labCreatedSlots={labCreatedSlots}
	                  spotifyBuild={activeSpotifyBuild}
	                  onSpotifyUndo={undoSpotifyPiece}
	                  onSpotifySubmit={submitSpotifyDesign}
	                  isDashboardOpen={isDashboardOpen}
	                  onToggleDashboard={() => setIsDashboardOpen(!isDashboardOpen)}
	                  savedElements={savedElements}
	                  gameState={gameState}
	                  deathReason={deathReason}
	                  showSixtySeven={showSixtySeven}
	              />
	            </>
	          )}
            <Dashboard 
               isOpen={isDashboardOpen}
               onClose={() => {
                 // Reload slots when closing dashboard in case they changed
                 const savedSlots = localStorage.getItem('labSlots');
                 if (savedSlots) {
                   try {
                     const parsed = JSON.parse(savedSlots);
                     setLabSlots(parsed);
                     // Update active elements if current ones are not in slots
                     if (parsed.length > 0 && !parsed.find(e => e.symbol === leftElement.symbol)) {
                       setLeftElement(parsed[0]);
                     }
                     if (parsed.length > 1 && !parsed.find(e => e.symbol === rightElement.symbol)) {
                       setRightElement(parsed[1] || parsed[0]);
                     }
                   } catch (e) {
                     console.error('Failed to parse saved slots', e);
                   }
                 }
                 
                 // Clear lab-created slots when returning from dashboard
                 setLabCreatedSlots([]);
                 localStorage.removeItem('labCreatedSlots');
                 
                 setIsDashboardOpen(false);
               }}
	               savedElements={savedElements}
	               labSlots={labSlots}
	               onStartQuiz={startQuiz}
	               onStartSpotify={startSpotifyChallenge}
	            />
            {!isDashboardOpen && (
            <MascotGuide 
               message={displayedMessage}
               isDashboardOpen={isDashboardOpen}
                trackingData={trackingDataRef}
                combinedElement={displayedCombinedElement}
                advice={mascotAdvice}
            />
            )}
        </>
      )}
    </div>
  );
};

export default App;
