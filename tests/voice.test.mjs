import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { APP_ORIGIN, CHANNEL, parseBridgeMessage, shouldResetForNavigation } from '../src/bridgeProtocol.ts';
import { nativeBridgeScript } from '../src/nativeBridgeScript.ts';

const packet = (type, extra={}) => ({channel:CHANNEL,doc:'document1',id:1,type,...extra});
test('bridge accepts only valid trusted-origin messages', () => {
  assert.ok(parseBridgeMessage(JSON.stringify(packet('voice.listen')),APP_ORIGIN));
  for(const url of ['https://example.org',APP_ORIGIN+'.evil.org','http://lauraslinguistics.base44.app']) assert.equal(parseBridgeMessage(JSON.stringify(packet('voice.listen')),url),null);
  for(const p of [packet('gps.start'),packet('voice.listen',{id:-1}),packet('speech.say',{text:'a'.repeat(2001)}),packet('voice.listen',{channel:'red-alert-native-v1'})]) assert.equal(parseBridgeMessage(JSON.stringify(p),APP_ORIGIN),null);
});
test('same-origin SPA navigation preserves native document', () => {
  assert.equal(shouldResetForNavigation(APP_ORIGIN+'/?next=1'),false);
  assert.equal(shouldResetForNavigation('https://app.base44.com/login'),true);
});
test('bootstrap forwards dictation updates and completion once, and ignores foreign document', () => {
  const messages=[], win={location:{origin:APP_ORIGIN},ReactNativeWebView:{postMessage:s=>messages.push(JSON.parse(s))},dispatchEvent:()=>{}};
  const context={window:win,location:win.location,CustomEvent:class{}};
  vm.runInNewContext(nativeBridgeScript,context);
  const bridge=win.LauraNative, doc=messages[0].doc;
  const updates=[],results=[];const id=bridge.dictate(t=>updates.push(t),t=>results.push(t));
  bridge.receive({channel:CHANNEL,doc:'wrong',id,type:'voice.partial',text:'bad'});
  bridge.receive({channel:CHANNEL,doc,id,type:'voice.partial',text:'hello'});
  bridge.receive({channel:CHANNEL,doc,id,type:'voice.result',text:'hello world'});
  bridge.receive({channel:CHANNEL,doc,id,type:'voice.result',text:'duplicate'});
  assert.deepEqual(updates,['hello']);assert.deepEqual(results,['hello world']);
  vm.runInNewContext(nativeBridgeScript,context);assert.equal(win.LauraNative,bridge);
});

function host(permission=Promise.resolve({granted:true})) {
  const events={},states=[],effects=[],out=[],calls=[];
  const recognition={requestPermissionsAsync:()=>permission,start:()=>calls.push('start'),stop:()=>calls.push('stop'),abort:()=>calls.push('abort')};
  const ports={
    react:{useState:v=>{const i=states.push(v)-1;return[v,x=>states[i]=x];},useRef:v=>({current:v}),useEffect:fn=>effects.push(fn)},
    'react-native':{AppState:{addEventListener:(_,fn)=>{events.appState=fn;return{remove(){}};}}},
    'expo-speech':{stop:async()=>{},speak:()=>{}},
    'expo-speech-recognition':{ExpoSpeechRecognitionModule:recognition,useSpeechRecognitionEvent:(name,fn)=>events[name]=fn},
    './bridgeProtocol':{APP_ORIGIN,CHANNEL,parseBridgeMessage}
  };
  const source=ts.transpileModule(fs.readFileSync(new URL('../src/useNativeVoice.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(source,{exports,require:n=>ports[n],setTimeout,clearTimeout,URL,Promise});
  const api=exports.useNativeVoice({current:{injectJavaScript:s=>out.push(s)}});const cleanup=effects[0]();
  const message=(type,extra={})=>api.onMessage({nativeEvent:{url:APP_ORIGIN,data:JSON.stringify(packet(type,extra))}});
  message('bridge.ready');
  return {api,events,states,out,calls,message,cleanup};
}
test('dictation is off by default and starts only on explicit request', async()=>{
  const h=host();assert.deepEqual(h.calls,[]);h.message('voice.listen');await new Promise(setImmediate);
  assert.deepEqual(h.calls,['start']);assert.equal(h.states[0],'listening');h.cleanup();
});
test('cancel during permission prevents late microphone start', async()=>{
  let grant;const h=host(new Promise(r=>grant=r));h.message('voice.listen');h.api.cancelVoice();grant({granted:true});await new Promise(setImmediate);
  assert.deepEqual(h.calls,[]);assert.equal(h.states[0],'off');h.cleanup();
});
test('denied permission finishes request without starting recognition',async()=>{
  const h=host(Promise.resolve({granted:false}));h.message('voice.listen');await new Promise(setImmediate);
  assert.deepEqual(h.calls,[]);assert.ok(h.out.some(s=>s.includes('not-allowed')));h.cleanup();
});
test('native stop keeps transcript; end finishes once without restarting',async()=>{
  const h=host();h.message('voice.listen');await new Promise(setImmediate);
  h.events.result({results:[{transcript:'my message'}],isFinal:false});h.message('voice.stop');h.events.end();h.events.end();
  assert.deepEqual(h.calls,['start','stop']);assert.equal(h.states[0],'off');
  assert.equal(h.out.filter(s=>s.includes('voice.result')).length,1);assert.ok(h.out.some(s=>s.includes('my message')));h.cleanup();
});
test('backgrounding cancels capture, rejects new requests, then ends cleanly',async()=>{
  const h=host();h.message('voice.listen');await new Promise(setImmediate);h.events.appState('background');h.message('voice.listen',{id:2});h.events.end();
  assert.deepEqual(h.calls,['start','abort']);assert.equal(h.states[0],'off');h.cleanup();
});
test('voice capture does not automatically restart after a recognition error',async()=>{
  const h=host();h.message('voice.listen');await new Promise(setImmediate);h.events.error({error:'network',message:'offline'});h.events.end();
  assert.deepEqual(h.calls,['start']);assert.equal(h.states[0],'off');h.cleanup();
});
