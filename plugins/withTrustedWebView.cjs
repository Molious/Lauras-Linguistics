const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');
const MARK = 'LAURA_TRUSTED_WEBVIEW_V1';
function secureWebViewSource(source) {
  if (source.includes(MARK)) return source;
  const fallback = `        } else {
          if (fallbackBridge == null) {
            fallbackBridge = new RNCWebViewBridge(webView);
            addJavascriptInterface(fallbackBridge, JAVASCRIPT_INTERFACE);
          }
        }`;
  const callback = 'RNCWebView.this.onMessage(message.getData(), sourceOrigin.toString());';
  for (const fragment of [fallback, callback, 'Set.of("*")']) {
    if (!source.includes(fragment)) throw new Error('WebView origin enforcement no longer matches pinned react-native-webview 13.16.1. Review the native bridge before building.');
  }
  return source
    .replace(fallback, `        } else {
          // ${MARK}: older WebViews cannot authenticate the sending frame.
          messagingEnabled = false;
          return;
        }`)
    .replace(callback, 'if (!isMainFrame) return;\n                '+callback)
    .replace('Set.of("*")', 'Set.of("https://lauraslinguistics.base44.app")');
}
module.exports = config => withDangerousMod(config, ['android', async config => {
  const file = path.join(config.modRequest.projectRoot, 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java');
  const source = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, secureWebViewSource(source));
  return config;
}]);
module.exports.secureWebViewSource = secureWebViewSource;
