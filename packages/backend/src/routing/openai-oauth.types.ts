export interface PendingOAuth {
  verifier: string;
  agentId: string;
  userId: string;
  backendUrl: string;
  expiresAt: number;
}

export interface OAuthTokenBlob {
  /** access token */
  t: string;
  /** refresh token */
  r: string;
  /** expires at (epoch ms) */
  e: number;
  /** provider-specific resource URL / base URL */
  u?: string;
}

export function parseOAuthTokenBlob(rawValue: string): OAuthTokenBlob | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<OAuthTokenBlob>;
    if (
      typeof parsed?.t !== 'string' ||
      typeof parsed?.r !== 'string' ||
      typeof parsed?.e !== 'number'
    ) {
      return null;
    }
    return parsed as OAuthTokenBlob;
  } catch {
    return null;
  }
}

export function oauthDoneHtml(success: boolean): string {
  const message = success ? 'manifest-oauth-success' : 'manifest-oauth-error';
  const text = success
    ? 'Login successful!'
    : 'Login failed. Please close this window and try again.';

  return `<!DOCTYPE html>
<html>
<head><title>Manifest — OpenAI Login</title></head>
<body style="font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#eee;">
<p>${text}</p>
<p id="hint" style="font-size:13px;color:#888;display:none;">You can close this window.</p>
<script>
try{var bc=new BroadcastChannel('manifest-oauth');bc.postMessage({type:'${message}'});bc.close();}catch(e){}
if(window.opener){window.opener.postMessage({type:'${message}'},window.location.origin);}
setTimeout(function(){window.close();document.getElementById('hint').style.display='block';},1500);
</script>
</body>
</html>`;
}
