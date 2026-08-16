import { useState, useEffect } from "react";

export default function InstallButton({ compact = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") setInstalled(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("pageshow", onVisibility);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (installed || !deferredPrompt) return null;
  return (
    <button type="button" className="install-btn" onClick={install} title="Install Life Planner on this device">
      <i className="fa-solid fa-download"></i>
      {!compact && <span>Install App</span>}
    </button>
  );
}