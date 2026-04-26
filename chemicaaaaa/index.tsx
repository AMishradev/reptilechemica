import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import LandingPage from "./LandingPage";
import MultiplayerGate from "./components/MultiplayerRoom";
import { MULTIPLAYER_ROOM_PARAM, normalizeRoomCode } from "./utils/multiplayer";

const convexUrl = import.meta.env.VITE_CONVEX_URL || "";

if (!convexUrl && import.meta.env.DEV) {
  console.warn(
    "VITE_CONVEX_URL is not set. Convex sync is disabled for this session."
  );
}

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = ReactDOM.createRoot(rootElement);

const LabRoute = () => {
  const [searchParams] = useSearchParams();
  const roomId = normalizeRoomCode(searchParams.get(MULTIPLAYER_ROOM_PARAM));

  return <MultiplayerGate roomId={roomId} />;
};

const routes = (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<LabRoute />} />
    </Routes>
  </BrowserRouter>
);

root.render(
  <React.StrictMode>
    {convex ? <ConvexProvider client={convex}>{routes}</ConvexProvider> : routes}
  </React.StrictMode>
);
