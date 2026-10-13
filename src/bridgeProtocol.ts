export const APP_ORIGIN = 'https://lauraslinguistics.base44.app';
export const CHANNEL = 'laura-native-v1';
export type Message = { channel: string; doc: string; id: number; type: string; text?: string };
const types = new Set(['bridge.ready', 'voice.listen', 'voice.stop', 'voice.cancel', 'speech.say', 'speech.cancel']);
export function parseBridgeMessage(raw: string, url: string): Message | null {
  try {
    if (raw.length > 10000 || new URL(url).origin !== APP_ORIGIN) return null;
    const m = JSON.parse(raw);
    if (m.channel !== CHANNEL || typeof m.doc !== 'string' || m.doc.length < 4 || m.doc.length > 100 || !Number.isSafeInteger(m.id) || m.id < 0 || !types.has(m.type)) return null;
    if (m.type === 'speech.say' && (typeof m.text !== 'string' || m.text.length > 2000)) return null;
    return m;
  } catch { return null; }
}
export function shouldResetForNavigation(url: string): boolean {
  try { return new URL(url).origin !== APP_ORIGIN; } catch { return true; }
}
