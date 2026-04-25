import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import LandingPage from "./LandingPage";

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

const routes = (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play" element={<App />} />
    </Routes>
  </BrowserRouter>
);

root.render(
  <React.StrictMode>
    {convex ? <ConvexProvider client={convex}>{routes}</ConvexProvider> : routes}
  </React.StrictMode>
);
