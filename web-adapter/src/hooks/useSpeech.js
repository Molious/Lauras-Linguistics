import { useCallback, useEffect, useRef, useState } from "react";
import { useNativeBridge } from "./useNativeBridge";

// Read a translated section aloud with the browser's built-in voice (speechSynthesis), free and offline on
// most phones. One section plays at a time; tapping the playing one again stops it.
const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

export function useSpeech() {
  const [playing, setPlaying] = useState(null);
  const currentRef = useRef(null);
  const nativeRef = useRef(null);
  const bridge = useNativeBridge();

  const stop = useCallback(() => {
    currentRef.current = null;
    nativeRef.current?.hush();
    nativeRef.current = null;
    setPlaying(null);
    try {
      synth?.cancel();
    } catch {
      // nothing playing
    }
  }, []);

  const play = useCallback((id, text) => {
    if (!text) return;
    if (bridge) {
      stop();
      const token = {};
      currentRef.current = token;
      nativeRef.current = bridge;
      setPlaying(id);
      // Android limits one spoken utterance. Read long results in order.
      let remaining = String(text);
      const next = () => {
        if (currentRef.current !== token) return;
        if (!remaining) { currentRef.current = null; nativeRef.current = null; setPlaying(null); return; }
        let end = Math.min(1900, remaining.length);
        if (end < remaining.length) { const space = remaining.lastIndexOf(" ", end); if (space > 950) end = space; }
        const chunk = remaining.slice(0, end);
        remaining = remaining.slice(end).trimStart();
        bridge.speak(chunk, (failed) => { if (failed) { if (currentRef.current === token) stop(); } else next(); });
      };
      next();
      return;
    }
    if (!synth) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = navigator.language || "en-AU";
      u.rate = 0.98;
      const done = () => {
        if (currentRef.current !== u) return;
        currentRef.current = null;
        setPlaying(null);
      };
      u.onend = done;
      u.onerror = done;
      currentRef.current = u;
      setPlaying(id);
      synth.speak(u);
    } catch {
      setPlaying(null);
    }
  }, [bridge, stop]);

  const toggle = useCallback((id, text) => (playing === id ? stop() : play(id, text)), [playing, play, stop]);

  useEffect(() => () => {
    currentRef.current = null;
    nativeRef.current?.hush();
    nativeRef.current = null;
    try {
      synth?.cancel();
    } catch {
      // nothing playing
    }
  }, []);

  return { supported: !!bridge || !!synth, playing, play, stop, toggle };
}
