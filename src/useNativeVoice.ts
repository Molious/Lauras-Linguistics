import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule as Recognition, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import type WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { APP_ORIGIN, CHANNEL, parseBridgeMessage, type Message } from './bridgeProtocol';

type Capture = { request: Message; epoch: number; text: string; error: string | null; started: boolean; delivered: boolean };
export function useNativeVoice(web: React.RefObject<WebView | null>) {
  const [phase, setPhase] = useState('off');
  const [error, setError] = useState('');
  const document = useRef<string | null>(null);
  const capture = useRef<Capture | null>(null);
  const epoch = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(true);
  const alive = useRef(true);
  const speechEpoch = useRef(0);
  const finishSpeech = useRef<(() => void) | null>(null);
  const send = (r: Message, type: string, extra: object = {}) => {
    if (!alive.current || document.current !== r.doc) return;
    const payload = JSON.stringify({ channel: CHANNEL, doc: r.doc, id: r.id, type, ...extra });
    web.current?.injectJavaScript(`location.origin === ${JSON.stringify(APP_ORIGIN)} && window.LauraNative && window.LauraNative.receive(${payload}); true;`);
  };
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const finish = (c: Capture) => {
    if (!c.delivered) { c.delivered = true; send(c.request, 'voice.result', { text: c.text, error: c.error }); }
  };
  const cancelVoice = () => {
    const c = capture.current;
    ++epoch.current; clearTimer();
    if (!c) return;
    c.error = 'aborted'; finish(c);
    if (c.started) { setPhase('stopping'); Recognition.abort(); }
    else { capture.current = null; setPhase('off'); }
  };
  const stopVoice = () => {
    const c = capture.current;
    if (!c) return;
    if (!c.started) { cancelVoice(); return; }
    clearTimer(); setPhase('stopping'); Recognition.stop();
  };
  const stopSpeech = () => {
    ++speechEpoch.current; void Speech.stop(); finishSpeech.current?.(); finishSpeech.current = null;
  };
  const reset = () => { document.current = null; cancelVoice(); stopSpeech(); };
  const listen = async (r: Message) => {
    if (!active.current || capture.current) { send(r, 'voice.result', { error: 'busy', text: '' }); return; }
    stopSpeech(); setError(''); setPhase('permission');
    const c: Capture = { request: r, epoch: ++epoch.current, text: '', error: null, started: false, delivered: false };
    capture.current = c;
    try {
      const p = await Recognition.requestPermissionsAsync();
      if (capture.current !== c || c.epoch !== epoch.current || document.current !== r.doc || !active.current) return;
      if (!p.granted) { c.error = 'not-allowed'; finish(c); capture.current = null; setPhase('off'); return; }
      c.started = true;
      Recognition.start({ lang: 'en-AU', interimResults: true, continuous: false, maxAlternatives: 1, recordingOptions: { persist: false } });
      setPhase('listening');
      timer.current = setTimeout(stopVoice, 60000);
    } catch {
      if (capture.current !== c) return;
      c.error = 'audio-capture'; finish(c); capture.current = null; clearTimer(); setPhase('off');
    }
  };
  useSpeechRecognitionEvent('result', e => {
    const c = capture.current;
    if (!c || c.delivered || c.epoch !== epoch.current) return;
    c.text = e.results[0]?.transcript || c.text;
    send(c.request, 'voice.partial', { text: c.text });
  });
  useSpeechRecognitionEvent('error', e => {
    const c = capture.current;
    if (!c) return;
    c.error = e.error;
    if (e.error !== 'aborted') setError(e.message || e.error);
    finish(c);
  });
  useSpeechRecognitionEvent('end', () => {
    const c = capture.current;
    if (c) finish(c);
    capture.current = null; clearTimer(); if (alive.current) setPhase('off');
  });
  const speak = (r: Message) => {
    cancelVoice(); stopSpeech();
    if (!active.current) { send(r, 'speech.error'); return; }
    const token = speechEpoch.current;
    let finished = false;
    const done = (failed = false) => {
      if (finished) return; finished = true;
      send(r, failed ? 'speech.error' : 'speech.end');
    };
    finishSpeech.current = () => done(true);
    Speech.speak(r.text!, { language: 'en-AU', rate: .98,
      onDone: () => { if (speechEpoch.current === token) done(); }, onStopped: () => done(true), onError: () => done(true) });
  };
  const onMessage = (e: WebViewMessageEvent) => {
    const m = parseBridgeMessage(e.nativeEvent.data, e.nativeEvent.url);
    if (!m) return;
    if (m.type === 'bridge.ready') { if (document.current !== m.doc) { reset(); document.current = m.doc; } return; }
    if (document.current !== m.doc) return;
    if (m.type === 'voice.listen') void listen(m);
    if (m.type === 'voice.stop' && capture.current?.request.id === m.id) stopVoice();
    if (m.type === 'voice.cancel' && capture.current?.request.id === m.id) cancelVoice();
    if (m.type === 'speech.say') speak(m);
    if (m.type === 'speech.cancel') stopSpeech();
  };
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener('change', s => { active.current = s === 'active'; if (!active.current) { cancelVoice(); stopSpeech(); } });
    return () => { alive.current = false; reset(); sub.remove(); };
  }, []);
  return { phase, error, onMessage, reset, cancelVoice };
}
