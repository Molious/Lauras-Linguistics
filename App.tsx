import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { useNativeVoice } from './src/useNativeVoice';
import { nativeBridgeScript } from './src/nativeBridgeScript';
import { APP_ORIGIN, shouldResetForNavigation } from './src/bridgeProtocol';

export default function App() {
  const web = useRef<WebView | null>(null);
  const native = useNativeVoice(web);
  const [loadError, setLoadError] = useState('');
  return <SafeAreaProvider><SafeAreaView style={s.page}>
    <StatusBar style="light" />
    <View style={s.status}><Text style={s.label}>Laura’s Linguistics</Text><Text style={s.label}>MIC: {native.phase.toUpperCase()}</Text></View>
    {!!loadError && <View style={s.status}><Text style={s.error}>{loadError}</Text><Pressable onPress={() => web.current?.reload()}><Text style={s.label}>RETRY</Text></Pressable></View>}
    {!!native.error && <Text style={s.error}>{native.error}</Text>}
    <WebView ref={web} source={{ uri: APP_ORIGIN }} style={s.web}
      javaScriptEnabled domStorageEnabled mixedContentMode="never"
      injectedJavaScriptBeforeContentLoaded={nativeBridgeScript} injectedJavaScript={nativeBridgeScript}
      onMessage={native.onMessage} onLoadStart={() => setLoadError('')}
      onNavigationStateChange={nav => { if (shouldResetForNavigation(nav.url)) native.reset(); }}
      onError={e => setLoadError(e.nativeEvent.description)}
      onHttpError={e => setLoadError(`Connection returned ${e.nativeEvent.statusCode}.`)}
      onContentProcessDidTerminate={() => { native.reset(); setLoadError('The app view stopped. Tap Retry to reopen it.'); }}
      onShouldStartLoadWithRequest={r => r.url.startsWith('https://') || r.url === 'about:blank'} />
    {native.phase !== 'off' && <Pressable style={s.cancel} onPress={() => native.cancelVoice()}><Text style={s.label}>CANCEL DICTATION</Text></Pressable>}
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0A0612' }, web: { flex: 1, backgroundColor: '#0A0612' },
  status: { flexDirection: 'row', justifyContent: 'space-between', padding: 8 },
  label: { color: '#35E8E0', fontSize: 12 }, error: { color: '#ffb4bc', padding: 8, flexShrink: 1 },
  cancel: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1033' },
});
