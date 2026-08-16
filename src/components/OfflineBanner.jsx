import { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      <i className="fa-solid fa-wifi"></i>
      <span>You're offline — your workspace is cached and will sync when you're back online.</span>
    </div>
  );
}