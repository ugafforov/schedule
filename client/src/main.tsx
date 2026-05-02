import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker immediately on page load (before React mounts)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => console.log("[PWA] Service worker registered"))
      .catch((err) => console.warn("[PWA] SW registration failed:", err));
  });
}

// Capture beforeinstallprompt early before React mounts
(window as any).__pwaInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
  window.dispatchEvent(new Event("pwaInstallReady"));
});

createRoot(document.getElementById("root")!).render(<App />);
