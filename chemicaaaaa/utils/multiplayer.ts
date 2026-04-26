import { COMBINATIONS, ELEMENTS } from "../constants";
import { ElementData, MultiplayerLabState, SpotifyBuildState } from "../types";

export const MULTIPLAYER_ROOM_PARAM = "room";
export const MULTIPLAYER_ROOM_PREFIX = "reptile-systems";
export const LIVEBLOCKS_PUBLIC_KEY = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY || "";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const createInactiveSpotifyBuild = (): SpotifyBuildState => ({
  active: false,
  builtSymbols: [],
  targetPieceCount: 4,
});

export const createInitialMultiplayerLabState = (): MultiplayerLabState => ({
  leftSymbol: "CLIENT",
  rightSymbol: "LB",
  combinedSymbol: null,
  message: "LAB READY",
  labSlotSymbols: [],
  labCreatedSlotSymbols: [],
  spotifyBuild: createInactiveSpotifyBuild(),
});

export const createRoomCode = () =>
  Array.from({ length: 4 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");

export const normalizeRoomCode = (value: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12);
  return normalized || null;
};

export const getShareUrl = (roomId: string) => {
  const url = new URL("/play", window.location.origin);
  url.searchParams.set(MULTIPLAYER_ROOM_PARAM, roomId);
  return url.toString();
};

export const getRoomPath = (roomId: string) => {
  const params = new URLSearchParams();
  params.set(MULTIPLAYER_ROOM_PARAM, roomId);
  return `/play?${params.toString()}`;
};

export const getLiveblocksRoomId = (roomId: string) => `${MULTIPLAYER_ROOM_PREFIX}-${roomId}`;

const allElements = [...ELEMENTS, ...COMBINATIONS.map((combination) => combination.result)];

export const getElementBySymbol = (symbol: string | null | undefined): ElementData | null =>
  allElements.find((element) => element.symbol === symbol) ?? null;

export const symbolsFromElements = (elements: ElementData[]) =>
  elements.map((element) => element.symbol);

export const elementsFromSymbols = (symbols: string[]) =>
  symbols.map(getElementBySymbol).filter((element): element is ElementData => Boolean(element));

export const sameSymbolList = (left: string[], right: string[]) =>
  left.length === right.length && left.every((symbol, index) => symbol === right[index]);

export const sameSpotifyBuild = (left: SpotifyBuildState, right: SpotifyBuildState) =>
  left.active === right.active &&
  left.targetPieceCount === right.targetPieceCount &&
  sameSymbolList(left.builtSymbols, right.builtSymbols);

export const sameMultiplayerLabState = (left: MultiplayerLabState, right: MultiplayerLabState) =>
  left.leftSymbol === right.leftSymbol &&
  left.rightSymbol === right.rightSymbol &&
  left.combinedSymbol === right.combinedSymbol &&
  left.message === right.message &&
  sameSymbolList(left.labSlotSymbols, right.labSlotSymbols) &&
  sameSymbolList(left.labCreatedSlotSymbols, right.labCreatedSlotSymbols) &&
  sameSpotifyBuild(left.spotifyBuild, right.spotifyBuild);

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
