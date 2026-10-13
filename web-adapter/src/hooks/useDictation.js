import { useCallback, useEffect, useRef, useState } from "react";
import { useNativeBridge } from "./useNativeBridge";

// Talk instead of type: the browser's own speech recognition (Web Speech API), free and on-device or
// browser-provided, writes what you say into the message box as you speak. Words are added after whatever
// is already there, so you can type a bit, talk a bit, then edit before translating.
const Recognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const dictationSupported = !!Recognition;

const ERRORS = {
  "not-allowed": "Microphone access is blocked. Allow the microphone for this site in your browser settings, then tap the mic again.",
  "service-not-allowed": "Microphone access is blocked. Allow the microphone for this site in your browser settings, then tap the mic again.",
  "no-speech": "I didn't catch anything. Tap the mic and try again.",
  "audio-capture": "No microphone was found on this device.",
  network: "Speech-to-text needs an internet connection in this browser. Check your connection and try again.",
};

export function useDictation({ value, onChange, maxLength = 4000 }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const nativeRef = useRef(null);
  const bridge = useNativeBridge();
  const baseRef = useRef("");
  const finalRef = useRef("");
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const stop = useCallback(() => {
    if (nativeRef.current) { nativeRef.current.bridge.stopDictation(nativeRef.current.id); return; }
    try {
      recRef.current?.stop();
    } catch {
      // already stopped
    }
  }, []);

  const start = useCallback(() => {
    if (nativeRef.current || recRef.current) return;
    setError("");
    if (bridge) {
      const current = valueRef.current || "";
      const base = current && !/\s$/.test(current) ? current + " " : current;
      const request = { bridge, id: null };
      nativeRef.current = request;
      setListening(true);
      const update = (text) => {
        if (nativeRef.current !== request) return;
        onChangeRef.current((base + text).slice(0, maxLength));
      };
      request.id = bridge.dictate(update, (text, reason) => {
        if (nativeRef.current !== request) return;
        if (text) update(text);
        nativeRef.current = null;
        setListening(false);
        if (reason && reason !== "aborted") setError(
          reason === "not-allowed" ? "Microphone access is blocked. Allow it in Android app settings, then try again."
          : ERRORS[reason] || "Dictation stopped. Tap the microphone to try again."
        );
      });
      return;
    }
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = navigator.language || "en-AU";
    rec.continuous = true;
    rec.interimResults = true;

    const current = valueRef.current || "";
    baseRef.current = current && !/\s$/.test(current) ? `${current} ` : current;
    finalRef.current = "";

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalRef.current += `${text.trim()} `;
        else interim += text;
      }
      onChangeRef.current((baseRef.current + finalRef.current + interim).slice(0, maxLength));
    };
    rec.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(ERRORS[event.error] || "The microphone stopped unexpectedly. Tap it to try again.");
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      // Keep only the words the recogniser settled on; a half-heard word is dropped.
      if (finalRef.current) onChangeRef.current((baseRef.current + finalRef.current).trimEnd().slice(0, maxLength));
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setError("The microphone couldn't start. Tap it to try again.");
    }
  }, [maxLength, bridge]);

  const toggle = useCallback(() => (nativeRef.current || recRef.current ? stop() : start()), [start, stop]);

  useEffect(
    () => () => {
      const native = nativeRef.current;
      nativeRef.current = null;
      if (native) native.bridge.cancelDictation(native.id);
      try {
        recRef.current?.abort();
      } catch {
        // nothing to stop
      }
    },
    []
  );

  return { supported: !!bridge || dictationSupported, listening, error, toggle, stop };
}
