/**
 * HTML the popup window shows after the OAuth dance completes. Posts a
 * BroadcastChannel message and a window.opener postMessage so the SPA can
 * detect completion without polling, then auto-closes.
 */
import type { AppLocale } from '../../../common/i18n/locale';

interface OAuthCallbackCopy {
  success: string;
  failure: string;
  hint: string;
  providerLabel: (label: string) => string;
}

const COPY = {
  en: {
    success: 'Login successful!',
    failure: 'Login failed. Please close this window and try again.',
    hint: 'You can close this window.',
    providerLabel: (label) => label,
  },
  ru: {
    success: 'Вход выполнен успешно!',
    failure: 'Не удалось войти. Закройте это окно и повторите попытку.',
    hint: 'Это окно можно закрыть.',
    providerLabel: (label) =>
      label === 'Login'
        ? 'Вход'
        : label.endsWith(' Login')
          ? `${label.slice(0, -' Login'.length)} — вход`
          : label,
  },
} satisfies Record<AppLocale, OAuthCallbackCopy>;

export function oauthDoneHtml(
  success: boolean,
  nonce?: string,
  providerLabel = 'Login',
  locale: AppLocale = 'en',
): string {
  const message = success ? 'manifest-oauth-success' : 'manifest-oauth-error';
  const copy = COPY[locale];
  const text = success ? copy.success : copy.failure;
  const localizedProviderLabel = copy.providerLabel(providerLabel);
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><title>Manifest — ${localizedProviderLabel}</title></head>
<body style="font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#eee;">
<p>${text}</p>
<p id="hint" style="font-size:13px;color:#888;display:none;">${copy.hint}</p>
<script${nonceAttr}>
try{var bc=new BroadcastChannel('manifest-oauth');bc.postMessage({type:'${message}'});bc.close();}catch(e){}
if(window.opener){window.opener.postMessage({type:'${message}'},'*');}
setTimeout(function(){window.close();document.getElementById('hint').style.display='block';},1500);
</script>
</body>
</html>`;
}
