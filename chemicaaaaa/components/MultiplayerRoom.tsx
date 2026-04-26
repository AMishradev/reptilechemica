import React, { useCallback, useMemo, useRef } from "react";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react";
import {
  useMutation,
  useOthers,
  useStorage,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import App from "../App";
import {
  createInitialMultiplayerLabState,
  getLiveblocksRoomId,
  LIVEBLOCKS_PUBLIC_KEY,
} from "../utils/multiplayer";
import {
  MultiplayerLabState,
  MultiplayerPeer,
  MultiplayerPresence,
  MultiplayerScreenSnapshot,
} from "../types";

interface MultiplayerGateProps {
  roomId: string | null;
}

const PEER_COLORS = ["#22d3ee", "#a78bfa", "#4ade80", "#f472b6", "#facc15", "#fb923c"];

const createPresence = (): MultiplayerPresence => {
  const color = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];

  return {
    cursor: null,
    selectedSymbol: null,
    screen: null,
    color,
    label: `Builder ${Math.floor(Math.random() * 90) + 10}`,
  };
};

const loadingFallback = (
  <div className="grid h-full w-full place-items-center bg-black text-cyan-100">
    <div className="font-mono text-sm tracking-normal text-cyan-200/70">
      Joining co-build room...
    </div>
  </div>
);

const MultiplayerCursorLayer: React.FC<{ peers: MultiplayerPeer[] }> = ({ peers }) => (
  <div className="pointer-events-none fixed inset-0 z-[500]" data-vision-ignore="true">
    {peers.map((peer) => {
      if (!peer.cursor) return null;

      return (
        <div
          key={peer.connectionId}
          className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2"
          style={{ left: peer.cursor.x, top: peer.cursor.y }}
        >
          <div
            className="h-5 w-5 rounded-full border-2 bg-black/50 shadow-[0_0_18px_currentColor]"
            style={{ color: peer.color, borderColor: peer.color }}
          />
          <div
            className="mt-1 whitespace-nowrap rounded bg-black/80 px-2 py-1 font-mono text-[10px] text-white shadow-lg"
            style={{ border: `1px solid ${peer.color}88` }}
          >
            {peer.label}
            {peer.selectedSymbol ? ` // ${peer.selectedSymbol}` : ""}
          </div>
        </div>
      );
    })}
  </div>
);

const MultiplayerScreenLayer: React.FC<{ peers: MultiplayerPeer[] }> = ({ peers }) => {
  const screens = peers.filter((peer) => Boolean(peer.screen?.imageDataUrl)).slice(0, 2);

  if (screens.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-32 z-[260] flex w-[min(18rem,34vw)] flex-col gap-3 max-md:top-24 max-md:w-[min(13rem,42vw)]"
      data-vision-ignore="true"
    >
      {screens.map((peer) => {
        const screen = peer.screen as MultiplayerScreenSnapshot;

        return (
          <div
            key={peer.connectionId}
            className="overflow-hidden rounded-lg border bg-black/78 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur-md"
            style={{ borderColor: `${peer.color}77` }}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-normal text-white/80">
              <span className="truncate" style={{ color: peer.color }}>
                {peer.label}
              </span>
              <span className="shrink-0 text-emerald-200">Live screen</span>
            </div>
            <div className="aspect-video bg-black">
              <img
                src={screen.imageDataUrl}
                alt={`${peer.label} screen`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2 font-mono text-[10px] text-cyan-100/70">
              <span className="truncate">{screen.message}</span>
              <span className="shrink-0 text-white/45">
                {screen.leftSymbol ?? "--"} + {screen.rightSymbol ?? "--"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MultiplayerLab: React.FC<{ roomId: string }> = ({ roomId }) => {
  const fallbackState = useMemo(() => createInitialMultiplayerLabState(), []);
  const storageState = useStorage((root) => {
    const labRoot = root as unknown as MultiplayerLabState;

    return {
      leftSymbol: labRoot.leftSymbol ?? fallbackState.leftSymbol,
      rightSymbol: labRoot.rightSymbol ?? fallbackState.rightSymbol,
      combinedSymbol: labRoot.combinedSymbol ?? null,
      message: labRoot.message ?? fallbackState.message,
      labSlotSymbols: labRoot.labSlotSymbols ?? [],
      labCreatedSlotSymbols: labRoot.labCreatedSlotSymbols ?? [],
      spotifyBuild: labRoot.spotifyBuild ?? fallbackState.spotifyBuild,
      timerStartedAt: labRoot.timerStartedAt ?? fallbackState.timerStartedAt,
      timerDurationMs: labRoot.timerDurationMs ?? fallbackState.timerDurationMs,
    };
  });
  const state = storageState ?? fallbackState;
  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();
  const lastPointerUpdateRef = useRef(0);

  const updateState = useMutation(({ storage }, patch: Partial<MultiplayerLabState>) => {
    const root = storage as unknown as {
      set: <K extends keyof MultiplayerLabState>(key: K, value: MultiplayerLabState[K]) => void;
    };

    (Object.entries(patch) as Array<[keyof MultiplayerLabState, MultiplayerLabState[keyof MultiplayerLabState]]>)
      .forEach(([key, value]) => {
        root.set(key, value);
      });
  }, []);

  const peers = useMemo<MultiplayerPeer[]>(
    () =>
      others
        .map((other) => {
          const presence = other.presence as unknown as MultiplayerPresence;

          if (!presence.cursor && !presence.screen) return null;

          return {
            connectionId: other.connectionId,
            cursor: presence.cursor ?? null,
            screen: presence.screen ?? null,
            color: presence.color || "#22d3ee",
            label: presence.label || `Builder ${other.connectionId}`,
            selectedSymbol: presence.selectedSymbol ?? null,
          };
        })
        .filter((peer): peer is MultiplayerPeer => Boolean(peer)),
    [others]
  );

  const onPointerMove = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const now = Date.now();
      if (now - lastPointerUpdateRef.current < 50) return;
      lastPointerUpdateRef.current = now;
      updateMyPresence({ cursor: { x: event.clientX, y: event.clientY } });
    },
    [updateMyPresence]
  );

  const onPointerLeave = useCallback(() => {
    updateMyPresence({ cursor: null });
  }, [updateMyPresence]);

  const updateSelectedSymbol = useCallback(
    (symbol: string | null) => {
      updateMyPresence({ selectedSymbol: symbol });
    },
    [updateMyPresence]
  );

  const updateScreenSnapshot = useCallback(
    (screen: MultiplayerScreenSnapshot | null) => {
      updateMyPresence({ screen });
    },
    [updateMyPresence]
  );

  const multiplayer = useMemo(
    () => ({
      roomId,
      state,
      peers,
      updateState,
      updateSelectedSymbol,
      updateScreenSnapshot,
      onPointerMove,
      onPointerLeave,
    }),
    [roomId, state, peers, updateState, updateSelectedSymbol, updateScreenSnapshot, onPointerMove, onPointerLeave]
  );

  return (
    <div className="relative h-full w-full">
      <App multiplayer={multiplayer} requestedRoomId={roomId} />
      <MultiplayerCursorLayer peers={peers} />
      <MultiplayerScreenLayer peers={peers} />
    </div>
  );
};

const MultiplayerGate: React.FC<MultiplayerGateProps> = ({ roomId }) => {
  if (!roomId) {
    return <App requestedRoomId={null} />;
  }

  if (!LIVEBLOCKS_PUBLIC_KEY) {
    return <App requestedRoomId={roomId} />;
  }

  return (
    <LiveblocksProvider publicApiKey={LIVEBLOCKS_PUBLIC_KEY} throttle={50} badgeLocation="bottom-left">
      <RoomProvider
        id={getLiveblocksRoomId(roomId)}
        initialPresence={createPresence() as any}
        initialStorage={createInitialMultiplayerLabState() as any}
      >
        <ClientSideSuspense fallback={loadingFallback}>
          <MultiplayerLab roomId={roomId} />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
};

export default MultiplayerGate;
