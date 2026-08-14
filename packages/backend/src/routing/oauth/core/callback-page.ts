/**
 * HTML the popup window shows after the OAuth dance completes. Posts a
 * BroadcastChannel message and a window.opener postMessage so the SPA can
 * detect completion without polling, then auto-closes.
 */
export function oauthDoneHtml(success: boolean, nonce?: string, providerLabel = 'Login'): string {
  const message = success ? 'manifest-oauth-success' : 'manifest-oauth-error';
  const text = success
    ? 'Login successful!'
    : 'Login failed. Please close this window and try again.';
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';

  return `<!DOCTYPE html>
<html>
<head><title>Manifest — ${providerLabel}</title></head>
<body style="font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#eee;">
<p>${text}</p>
<p id="hint" style="font-size:13px;color:#888;display:none;">You can close this window.</p>
<script${nonceAttr}>
try{var bc=new BroadcastChannel('manifest-oauth');bc.postMessage({type:'${message}'});bc.close();}catch(e){}
if(window.opener){window.opener.postMessage({type:'${message}'},'*');}
setTimeout(function(){window.close();document.getElementById('hint').style.display='block';},1500);
</script>
</body>
</html>`;
}
