
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Scene from './components/Scene';
import HandTracker from './components/HandTracker';
import UIOverlay from './components/UIOverlay';
import Dashboard from './components/Dashboard';
import MascotGuide from './components/MascotGuide';
import { ELEMENTS, COMBINATIONS } from './constants';
import { TrackingData, ElementData, GameState } from './types';
import successChime from './assets/sounds/success-chime.mp3';
import softError from './assets/sounds/soft-error.mp3';

const SESSION_RESET_KEYS = ['chemLabHistory', 'labSlots', 'labCreatedSlots'] as const;

const App: React.FC = () => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  
  const [leftElement, setLeftElement] = useState<ElementData>(ELEMENTS[0]);
  const [rightElement, setRightElement] = useState<ElementData>(ELEMENTS[3]); 
  
  const [combinedElement, setCombinedElement] = useState<ElementData | null>(null);
  const [message, setMessage] = useState("LAB READY");
  const [savedElements, setSavedElements] = useState<ElementData[]>([]);
  
  const [gameState, setGameState] = useState<GameState>('playing');
  const [deathReason, setDeathReason] = useState<string>('');
  const [showSixtySeven, setShowSixtySeven] = useState(false);
  const sixtySevenGestureProcessedRef = useRef(false);
  
  // Quiz Mode State
  const [quizMode, setQuizMode] = useState<{
    active: boolean;
    difficulty: 'easy' | 'medium' | null;
    targetSymbol: string | null;
    targetName: string | null;
  }>({ active: false, difficulty: null, targetSymbol: null, targetName: null });

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

  // Start each fresh app load from the default lab state.
  // We still use localStorage during the current run for dashboard/shelf sync,
  // but nothing carries over to the next session.
  useEffect(() => {
    SESSION_RESET_KEYS.forEach(key => localStorage.removeItem(key));
    setSavedElements([]);
    setLabSlots([]);
    setLabCreatedSlots([]);
    setLeftElement(ELEMENTS[0]);
    setRightElement(ELEMENTS[3]);
    setCombinedElement(null);
    setMessage("LAB READY");
  }, []);

  // Design Warning System
  useEffect(() => {
    if (gameState === 'dead') return;
    if (quizMode.active) return; // Disable warnings in Quiz Mode
    
    const symbols = [leftElement.symbol, rightElement.symbol];
    const hasClient = symbols.includes('CLIENT');
    const hasDatabase = symbols.includes('DB');
    
    if (hasClient && hasDatabase) {
       if (!message.includes("WARNING")) {
           setMessage("WARNING: Clients should not talk directly to databases.");
       }
    }
  }, [leftElement, rightElement, gameState, message, quizMode.active]);

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
      setIsDashboardOpen(false);
      setMessage(`QUIZ: CREATE ${targetName.toUpperCase()}`);
      // Clear any previous lab created slots
      setLabCreatedSlots([]);
  }, []);

  // Error State Ref (for update loop access)
  const fusionErrorRef = useRef(false);
  const lastInteractionTime = useRef(0);

  const trackingDataRef = useRef<TrackingData>({
    left: { pinchDistance: 0.5, isPinching: false, isPointing: false, position: {x: 0, y: 0, z: 0}, indexPosition: {x: 0, y: 0, z: 0}, isPresent: false },
    right: { pinchDistance: 0.5, isPinching: false, isPointing: false, position: {x: 0, y: 0, z: 0}, indexPosition: {x: 0, y: 0, z: 0}, isPresent: false },
    isClapping: false,
    isResetGesture: false,
    isClosedFist: false,
    leftIsFist: false,
    rightIsFist: false,
    isSixtySevenGesture: false,
    handDistance: 1000,
    cameraAspect: 1.77
  });

  const lastLeftHoverRef = useRef<string | null>(null);
  const lastRightHoverRef = useRef<string | null>(null);

  // Pin gesture state
  const [pinnedHand, setPinnedHand] = useState<'left' | 'right' | null>(null);
  const pinnedPosRef = useRef<{ x: number; y: number } | null>(null);
  const leftFistStartRef = useRef<number>(0);
  const rightFistStartRef = useRef<number>(0);
  const pinchConnectStartRef = useRef<number>(0);
  const interactionCooldownUntilRef = useRef<number>(0);
  const FIST_PIN_THRESHOLD = 500;
  const PINCH_CONNECT_THRESHOLD = 400;
  const PIN_PROXIMITY = 0.15;
  const SAVE_INTERACTION_COOLDOWN = 700;

  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  const checkCombination = useCallback(() => {
    if (combinedElement || gameState === 'dead') return;
    
    const symbols = [leftElement.symbol, rightElement.symbol];

    const combo = COMBINATIONS.find(c => 
      (c.elements[0] === leftElement.symbol && c.elements[1] === rightElement.symbol) ||
      (c.elements[1] === leftElement.symbol && c.elements[0] === rightElement.symbol)
    );

    if (combo) {
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
  }, [leftElement, rightElement, combinedElement, gameState, quizMode]);

  const handleOverlapMerge = useCallback(() => {
    if (Date.now() < interactionCooldownUntilRef.current) return;
    if (fusionErrorRef.current || combinedElement || gameState === 'dead') return;
    checkCombination();
  }, [checkCombination, combinedElement, gameState]);

  const handleOverlapChange = useCallback((isOverlapping: boolean) => {
    if (Date.now() < interactionCooldownUntilRef.current) return;
    if (combinedElement || gameState === 'dead') return;
    if (isOverlapping) {
      if (!message.includes("WARNING") && !message.includes("QUIZ:")) {
        setMessage("MERGING...");
      }
    } else {
      if (message === "MERGING...") {
        setMessage(quizMode.active && quizMode.targetName
          ? `QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`
          : pinnedHand ? (pinnedHand === 'left' ? "LEFT PINNED — BRING RIGHT HAND CLOSE" : "RIGHT PINNED — BRING LEFT HAND CLOSE")
          : "LAB READY");
      }
    }
  }, [combinedElement, gameState, message, quizMode, pinnedHand]);

  // Clear pin state whenever a combination is formed
  useEffect(() => {
    if (combinedElement) {
      setPinnedHand(null);
      pinnedPosRef.current = null;
      leftFistStartRef.current = 0;
      rightFistStartRef.current = 0;
      pinchConnectStartRef.current = 0;
    }
  }, [combinedElement]);

  // Play success sound when components are successfully combined
  const prevCombinedElementRef = useRef<ElementData | null>(null);
  useEffect(() => {
    // Only play sound when combinedElement changes from null to a value (new combination)
    if (combinedElement && 
        !prevCombinedElementRef.current &&
        combinedElement.symbol !== 'BOOM' && 
        combinedElement.symbol !== 'X' &&
        (message.includes('FUSION SUCCESS') || message.includes('QUIZ SUCCESS'))) {
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
                    message.includes('Incompatible') || 
                    message.includes('QUIZ FAILED') || 
                    message.includes('Design Unstable');
    
    // Check if this is a new error message (different from previous)
    const isNewError = isError && message !== prevMessageRef.current;
    
    // Don't play if it's a success message
    const isSuccess = message.includes('FUSION SUCCESS') || message.includes('QUIZ SUCCESS');
    
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

  const handleInteraction = useCallback((hit: HTMLElement, hand: 'LEFT' | 'RIGHT', isPinching: boolean = false) => {
      // Only trigger on pinch/click, not just hover
      if (!isPinching && !hit.id.startsWith('shelf-item-')) {
          return; // For non-shelf items, require pinch to interact
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
      if (hit.id.startsWith('dashboard-item-')) {
           // Trigger click on the component to select it
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
                 if (quizMode.active && quizMode.targetName) {
                     setMessage(`QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`);
                 } else {
                     setMessage("LAB READY");
                 }
             }, 1000);
          }
      }
  }, [labSlots, labCreatedSlots, isDashboardOpen, quizMode]);

  const onTrackingUpdate = useCallback((data: TrackingData) => {
    // Disable all gesture effects when dashboard is open
    if (isDashboardOpen) {
      // Still update the ref for visual tracking (mascot, etc.) but don't process gestures
      trackingDataRef.current = data;
      return;
    }
    
    trackingDataRef.current = data;
    const now = Date.now();
    
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
    
    if (gameState === 'dead') return;

    if (data.isResetGesture || (data.isClosedFist && combinedElement)) {
        if (combinedElement) {
            if (!quizMode.active) {
                saveElement(combinedElement);
                setMessage("ELEMENT SAVED TO SHELF");
                setTimeout(() => setMessage("LAB READY"), 2000);
            }
            setCombinedElement(null);
            fusionErrorRef.current = false;
            interactionCooldownUntilRef.current = now + SAVE_INTERACTION_COOLDOWN;
            lastLeftHoverRef.current = null;
            lastRightHoverRef.current = null;
            leftFistStartRef.current = 0;
            rightFistStartRef.current = 0;
            pinchConnectStartRef.current = 0;
        } else if (data.isResetGesture) {
            // Cancel active pin first; if no pin, reset error state
            if (pinnedHand) {
                setPinnedHand(null);
                pinnedPosRef.current = null;
                leftFistStartRef.current = 0;
                rightFistStartRef.current = 0;
                pinchConnectStartRef.current = 0;
                setMessage("PIN RELEASED");
                setTimeout(() => {
                    if (quizMode.active && quizMode.targetName) {
                        setMessage(`QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`);
                    } else {
                        setMessage("LAB READY");
                    }
                }, 1200);
            } else if (fusionErrorRef.current) {
                setCombinedElement(null);
                fusionErrorRef.current = false;
                if (quizMode.active && quizMode.targetName) {
                    setMessage(`QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`);
                } else {
                    setMessage("LAB READY");
                }
            }
        }
        return;
    }

    if (now < interactionCooldownUntilRef.current) {
        return;
    }

    if (fusionErrorRef.current) {
        if (!data.isClapping && data.handDistance > 0.25) {
            fusionErrorRef.current = false;
            if (quizMode.active && quizMode.targetName) {
                setMessage(`QUIZ: CREATE ${quizMode.targetName.toUpperCase()}`);
            } else {
                setMessage("LAB READY");
            }
        }
        return;
    }

    if (!combinedElement && !fusionErrorRef.current) {
        // Only hit test if the hand is present
        if (data.left.isPresent) {
            const leftHit = performHitTest(data.left.indexPosition.x, data.left.indexPosition.y, data.cameraAspect);
            if (leftHit) {
                if (leftHit.id !== lastLeftHoverRef.current || data.left.isPinching) {
                    handleInteraction(leftHit, 'LEFT', data.left.isPinching);
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
                    handleInteraction(rightHit, 'RIGHT', data.right.isPinching);
                    lastRightHoverRef.current = rightHit.id;
                 }
            } else {
                lastRightHoverRef.current = null;
            }
        } else {
             lastRightHoverRef.current = null;
        }
    }

    if (!combinedElement && !fusionErrorRef.current) {
      // --- PIN GESTURE: fist held for FIST_PIN_THRESHOLD ms pins that element ---
      if (!pinnedHand) {
        if (data.leftIsFist && data.left.isPresent) {
          if (leftFistStartRef.current === 0) leftFistStartRef.current = now;
          else if (now - leftFistStartRef.current > FIST_PIN_THRESHOLD) {
            setPinnedHand('left');
            pinnedPosRef.current = { x: data.left.position.x, y: data.left.position.y };
            leftFistStartRef.current = 0;
            setMessage("LEFT PINNED — BRING RIGHT HAND CLOSE");
          }
        } else {
          leftFistStartRef.current = 0;
        }

        if (data.rightIsFist && data.right.isPresent) {
          if (rightFistStartRef.current === 0) rightFistStartRef.current = now;
          else if (now - rightFistStartRef.current > FIST_PIN_THRESHOLD) {
            setPinnedHand('right');
            pinnedPosRef.current = { x: data.right.position.x, y: data.right.position.y };
            rightFistStartRef.current = 0;
            setMessage("RIGHT PINNED — BRING LEFT HAND CLOSE");
          }
        } else {
          rightFistStartRef.current = 0;
        }
      }

      // --- CONNECT GESTURE: moving hand approaches pinned element, then pinches ---
      if (pinnedHand && pinnedPosRef.current) {
        const pinned = pinnedPosRef.current;
        const movingHand = pinnedHand === 'left' ? data.right : data.left;

        if (movingHand.isPresent) {
          const dx = movingHand.position.x - pinned.x;
          const dy = movingHand.position.y - pinned.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < PIN_PROXIMITY) {
            if (movingHand.isPinching) {
              if (pinchConnectStartRef.current === 0) pinchConnectStartRef.current = now;
              else if (now - pinchConnectStartRef.current > PINCH_CONNECT_THRESHOLD) {
                checkCombination();
                pinchConnectStartRef.current = 0;
              } else if (!message.includes("WARNING") && !message.includes("QUIZ:")) {
                setMessage("PINCH HELD — FUSING...");
              }
            } else {
              pinchConnectStartRef.current = 0;
              if (!message.includes("WARNING") && !message.includes("QUIZ:") && !message.includes("PINNED")) {
                setMessage("IN RANGE — PINCH TO FUSE");
              }
            }
          } else {
            pinchConnectStartRef.current = 0;
            if (message === "IN RANGE — PINCH TO FUSE" || message === "PINCH HELD — FUSING...") {
              setMessage(pinnedHand === 'left'
                ? "LEFT PINNED — BRING RIGHT HAND CLOSE"
                : "RIGHT PINNED — BRING LEFT HAND CLOSE");
            }
          }
        }
      }
    }

  }, [combinedElement, message, checkCombination, handleInteraction, isDashboardOpen, quizMode]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      <HandTracker onUpdate={onTrackingUpdate} onCameraReady={handleCameraReady} />
      
      {!isCameraReady && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-white">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="font-['Orbitron'] text-xl animate-pulse tracking-widest text-cyan-500">INITIALIZING LAB</p>
          </div>
        </div>
      )}

      {isCameraReady && (
        <>
            <Scene
                leftElement={leftElement}
                rightElement={rightElement}
                combinedElement={combinedElement}
                trackingData={trackingDataRef}
                pinnedHand={pinnedHand}
                pinnedPosRef={pinnedPosRef}
                interactionCooldownUntilRef={interactionCooldownUntilRef}
                onOverlapMerge={handleOverlapMerge}
                onOverlapChange={handleOverlapChange}
            />
            <UIOverlay
                leftElement={leftElement}
                rightElement={rightElement}
                combinedElement={combinedElement}
                message={message}
                trackingRef={trackingDataRef}
                labSlots={labSlots}
                labCreatedSlots={labCreatedSlots}
                isDashboardOpen={isDashboardOpen}
                onToggleDashboard={() => setIsDashboardOpen(!isDashboardOpen)}
                savedElements={savedElements}
                gameState={gameState}
                deathReason={deathReason}
                showSixtySeven={showSixtySeven}
                pinnedHand={pinnedHand}
            />
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
            />
            <MascotGuide 
               message={message}
               isDashboardOpen={isDashboardOpen}
               trackingData={trackingDataRef}
               combinedElement={combinedElement}
            />
        </>
      )}
    </div>
  );
};

export default App;
