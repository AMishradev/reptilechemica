
export interface ElementData {
  symbol: string;
  name: string;
  color: string;
  atomicNumber: number;
  description: string;
  level?: number; // 1 = Base, 2 = Compound, 3 = Complex
}

export interface CombinationResult {
  elements: [string, string]; // symbols
  result: ElementData;
}

export interface HandGestureState {
  pinchDistance: number; // 0 to 1
  isPinching: boolean;
  isPointing: boolean; // Index finger up, others curled
  position: { x: number; y: number; z: number }; // Palm Center
  indexPosition: { x: number; y: number; z: number }; // Index Tip
  isDetected?: boolean; // Whether hand is currently being tracked
  isPresent: boolean; // Is the hand currently detected
}

export type Handedness = 'left' | 'right';

export type GameState = 'playing' | 'dead';

export interface TrackingData {
  left: HandGestureState;
  right: HandGestureState;
  isSnapReady: boolean; // Hands/components are close enough to snap-fuse
  isResetGesture: boolean; // Circular motion detected
  isClosedFist: boolean; // New gesture for saving
  isSixtySevenGesture: boolean; // Palms up + alternating motion detected
  handDistance: number;
  cameraAspect: number; // Width / Height
  hoveredElement?: string; // Symbol of element being hovered
}

export interface SpotifyBuildState {
  active: boolean;
  builtSymbols: string[];
  targetPieceCount: number;
}

export interface MultiplayerCursor {
  x: number;
  y: number;
}

export interface MultiplayerPresence {
  cursor: MultiplayerCursor | null;
  selectedSymbol: string | null;
  color: string;
  label: string;
}

export interface MultiplayerLabState {
  leftSymbol: string | null;
  rightSymbol: string | null;
  combinedSymbol: string | null;
  message: string;
  labSlotSymbols: string[];
  labCreatedSlotSymbols: string[];
  spotifyBuild: SpotifyBuildState;
}

export interface MultiplayerPeer {
  connectionId: number;
  cursor: MultiplayerCursor;
  color: string;
  label: string;
  selectedSymbol: string | null;
}

export interface MultiplayerSession {
  roomId: string;
  state: MultiplayerLabState;
  peers: MultiplayerPeer[];
  updateState: (patch: Partial<MultiplayerLabState>) => void;
  updateSelectedSymbol: (symbol: string | null) => void;
  onPointerMove: (event: { clientX: number; clientY: number }) => void;
  onPointerLeave: () => void;
}
