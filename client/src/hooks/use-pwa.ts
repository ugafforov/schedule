import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwa() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (window as any).__pwaInstallPrompt ?? null
  );
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches
  );
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    // Online / offline
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Install prompt (may arrive after mount)
    const onReady = () => {
      setInstallPrompt((window as any).__pwaInstallPrompt ?? null);
    };
    window.addEventListener("pwaInstallReady", onReady);

    // Installed detection
    const mq = window.matchMedia("(display-mode: standalone)");
    const onDisplay = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener("change", onDisplay);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pwaInstallReady", onReady);
      mq.removeEventListener("change", onDisplay);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      (window as any).__pwaInstallPrompt = null;
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

  return { isOnline, isInstalled, canInstall: !!installPrompt && !isInstalled, install };
}
