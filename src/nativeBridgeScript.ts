export const nativeBridgeScript = `
(function () {
  if (location.origin !== 'https://lauraslinguistics.base44.app' || !window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') return;
  if (window.LauraNative) { window.LauraNative.announce(); return; }
  var channel='laura-native-v1', doc=String(Date.now())+'-'+Math.random().toString(36).slice(2), serial=0, listeners={}, speeches={};
  function post(type,id,extra) { window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({channel:channel,doc:doc,type:type,id:id},extra||{}))); }
  window.LauraNative={
    version:1,
    announce:function(){post('bridge.ready',0);window.dispatchEvent(new CustomEvent('laura-native-ready'));},
    dictate:function(update,end){var id=++serial;listeners[id]={update:update,end:end};post('voice.listen',id);return id;},
    stopDictation:function(id){post('voice.stop',id);},
    cancelDictation:function(id){delete listeners[id];post('voice.cancel',id);},
    speak:function(text,done){var id=++serial;speeches[id]=done||function(){};post('speech.say',id,{text:String(text).slice(0,2000)});return id;},
    hush:function(){speeches={};post('speech.cancel',0);},
    receive:function(m){
      if(!m||m.channel!==channel||m.doc!==doc)return;
      var l=listeners[m.id],s=speeches[m.id];
      if(m.type==='voice.partial'&&l)l.update(m.text||'');
      if(m.type==='voice.result'&&l){delete listeners[m.id];l.end(m.text||'',m.error||null);}
      if((m.type==='speech.end'||m.type==='speech.error')&&s){delete speeches[m.id];s(m.type==='speech.error');}
    }
  };
  window.LauraNative.announce();
})(); true;
`;
