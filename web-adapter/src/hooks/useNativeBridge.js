import { useEffect, useState } from "react";
export function getNativeBridge() {
  if (typeof window === "undefined" || window.location.origin !== "https://lauraslinguistics.base44.app") return null;
  return window.LauraNative?.version === 1 ? window.LauraNative : null;
}
export function useNativeBridge() {
  const [bridge, setBridge] = useState(getNativeBridge);
  useEffect(() => {
    const refresh = () => setBridge(getNativeBridge());
    window.addEventListener("laura-native-ready", refresh);
    refresh();
    return () => window.removeEventListener("laura-native-ready", refresh);
  }, []);
  return bridge;
}
