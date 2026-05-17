import { createMemo, createSignal, type Component } from 'solid-js';
import TopBar from './components/TopBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Conversation from './components/Conversation.jsx';
import Composer from './components/Composer.jsx';
import { type HeaderEntry } from './components/HeaderEditor.jsx';
import { PROFILES, PROFILE_BY_ID, profilePath, type Profile, type ProfileLang } from './profiles';
import { partitionHeaders, sendRequest, type SendResult } from './send';
import {
  appendHistory,
  clearHistory,
  deleteHistory,
  listHistory,
  type HistoryEntry,
} from './services/history';
import { isExecutable, runUserCode } from './runners';
import { buildMarkdownReport } from './services/gist';
import { extractAssistantText } from './services/response-shape';
import GistModal from './components/GistModal.jsx';

const STORAGE = {
  baseUrl: 'wingman:baseUrl',
  apiKey: 'wingman:apiKey',
  model: 'wingman:model',
  profile: 'wingman:profile',
};

// API keys are stored in sessionStorage (cleared on tab close) instead of
// localStorage so contributors don't leave a long-lived `mnfst_*` token in
// disk-backed browser storage. Everything else (base URL, model, profile,
// system prompts, history) stays in localStorage since it's not sensitive.
const SENSITIVE_KEYS = new Set<string>(['wingman:apiKey']);

function storageFor(key: string): Storage {
  return SENSITIVE_KEYS.has(key) ? sessionStorage : localStorage;
}

function readStorage(key: string, fallback: string): string {
  try {
    const value = storageFor(key).getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function readQueryParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URL(window.location.href).searchParams.get(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    storageFor(key).setItem(key, value);
  } catch {
    /* ignore */
  }
}

function entriesFromRecord(record: Record<string, string>): HeaderEntry[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

function recordFromEntries(entries: HeaderEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, value } of entries) {
    if (key.trim()) out[key.trim()] = value;
  }
  return out;
}

function defaultBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const { protocol, hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (port === '3002' || port === '3000') return `${protocol}//${hostname}:3001`;
    return `${protocol}//${hostname}:${port || '3001'}`;
  }
  return `${protocol}//${hostname}`;
}

const App: Component = () => {
  const baseUrlParam = readQueryParam('baseUrl');
  const apiKeyParam = readQueryParam('apiKey');
  const initialBaseUrl = baseUrlParam ?? readStorage(STORAGE.baseUrl, defaultBaseUrl());
  const initialApiKey = apiKeyParam ?? readStorage(STORAGE.apiKey, '');
  if (baseUrlParam) writeStorage(STORAGE.baseUrl, baseUrlParam);
  if (apiKeyParam) writeStorage(STORAGE.apiKey, apiKeyParam);
  const [baseUrl, setBaseUrl] = createSignal(initialBaseUrl);
  const [apiKey, setApiKey] = createSignal(initialApiKey);
  const [model, setModel] = createSignal(readStorage(STORAGE.model, 'auto'));
  const [profileId, setProfileId] = createSignal(
    readStorage(STORAGE.profile, PROFILES[0]?.id ?? 'openclaw'),
  );

  const profile = createMemo<Profile>(() => PROFILE_BY_ID[profileId()] ?? PROFILES[0]!);

  const [systemPrompts, setSystemPrompts] = createSignal<Record<string, string>>(
    Object.fromEntries(PROFILES.map((p) => [p.id, p.defaultSystemPrompt ?? ''])),
  );
  const [userMessage, setUserMessage] = createSignal('Say hello in one short sentence.');
  const [headerOverrides, setHeaderOverrides] = createSignal<Record<string, HeaderEntry[]>>({});
  const [lang, setLang] = createSignal<ProfileLang>(profile().defaultLang);
  const [result, setResult] = createSignal<SendResult | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [hasSent, setHasSent] = createSignal(false);
  const [sentMessage, setSentMessage] = createSignal('');
  const [history, setHistory] = createSignal<HistoryEntry[]>(listHistory());
  const [activeHistoryId, setActiveHistoryId] = createSignal<string | null>(null);
  const [saveStatus, setSaveStatus] = createSignal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [gistMarkdown, setGistMarkdown] = createSignal<string>('');
  const [gistModalOpen, setGistModalOpen] = createSignal(false);
  // Edited code per `${profileId}:${lang}` — when present, it overrides the
  // generated snippet AND becomes the source of truth for Send (provided the
  // profile is executable in this language).
  const [scratchCode, setScratchCode] = createSignal<Record<string, string>>({});

  const generatedSdkCode = createMemo(() =>
    profile().code(
      {
        baseUrl: baseUrl().replace(/\/+$/, ''),
        apiKey: apiKey(),
        model: model(),
        systemPrompt: systemPrompts()[profile().id] ?? '',
        userMessage: userMessage(),
      },
      lang(),
    ),
  );

  const scratchKey = () => `${profile().id}:${lang()}`;
  const sdkCodeIsEdited = () => {
    const v = scratchCode()[scratchKey()];
    return v !== undefined && v !== generatedSdkCode();
  };
  const sdkCode = () => scratchCode()[scratchKey()] ?? generatedSdkCode();
  const sdkExecutable = () => (profile().executable ?? false) && isExecutable(profile().id, lang());
  const willRunCode = () => sdkCodeIsEdited() && sdkExecutable();

  const onSdkCodeChange = (next: string) => {
    setScratchCode({ ...scratchCode(), [scratchKey()]: next });
  };
  const resetSdkCode = () => {
    const next = { ...scratchCode() };
    delete next[scratchKey()];
    setScratchCode(next);
  };

  const params = () => ({
    baseUrl: baseUrl().replace(/\/+$/, ''),
    apiKey: apiKey(),
    model: model(),
    systemPrompt: systemPrompts()[profile().id] ?? '',
    userMessage: userMessage(),
  });

  const headerEntries = createMemo<HeaderEntry[]>(() => {
    const overrideKey = `${profile().id}:${lang()}`;
    const cached = headerOverrides()[overrideKey];
    if (cached) return cached;
    return entriesFromRecord(profile().headers(params()));
  });

  const updateHeaderEntries = (next: HeaderEntry[]) => {
    const overrideKey = `${profile().id}:${lang()}`;
    setHeaderOverrides({ ...headerOverrides(), [overrideKey]: next });
  };

  const resetHeaders = () => {
    const overrideKey = `${profile().id}:${lang()}`;
    const next = { ...headerOverrides() };
    delete next[overrideKey];
    setHeaderOverrides(next);
  };

  const blockedHeaderNames = () => {
    const { blocked } = partitionHeaders(recordFromEntries(headerEntries()));
    return blocked;
  };

  const setProfileSafely = (id: string) => {
    setProfileId(id);
    writeStorage(STORAGE.profile, id);
    const nextProfile = PROFILE_BY_ID[id];
    if (nextProfile && !nextProfile.langs.includes(lang())) {
      setLang(nextProfile.defaultLang);
    }
  };

  const persistAndSetBase = (value: string) => {
    setBaseUrl(value);
    writeStorage(STORAGE.baseUrl, value);
  };
  const persistAndSetKey = (value: string) => {
    setApiKey(value);
    writeStorage(STORAGE.apiKey, value);
  };
  const persistAndSetModel = (value: string) => {
    setModel(value);
    writeStorage(STORAGE.model, value);
  };

  const updateSystemPrompt = (value: string) => {
    setSystemPrompts({ ...systemPrompts(), [profile().id]: value });
  };

  const handleSend = async () => {
    setResult(null);
    setActiveHistoryId(null);
    setSaveStatus('idle');
    setLoading(true);
    setHasSent(true);
    setSentMessage(userMessage());

    let next: SendResult;
    let sentHeaders: Record<string, string>;

    if (willRunCode()) {
      // The user edited the SDK preview, and the profile/lang combination
      // can actually execute it in-browser. Run the code through the stub
      // SDK; whatever fetch the code triggers becomes the SendResult.
      try {
        const out = await runUserCode({
          profileId: profile().id,
          code: sdkCode(),
          baseUrl: baseUrl().replace(/\/+$/, ''),
          apiKey: apiKey(),
        });
        next = out.result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const url = `${baseUrl().replace(/\/+$/, '')}${profilePath(profile())}`;
        next = {
          url,
          status: 0,
          statusText: 'Code error',
          ok: false,
          durationMs: 0,
          requestHeaders: {},
          requestBody: '',
          responseHeaders: {},
          responseBody: '',
          responseJson: null,
          error: message,
        };
      }
      sentHeaders = next.requestHeaders;
    } else {
      sentHeaders = recordFromEntries(headerEntries());
      const body = profile().body(params());
      const url = `${baseUrl().replace(/\/+$/, '')}${profilePath(profile())}`;
      next = await sendRequest({ url, apiKey: apiKey(), headers: sentHeaders, body });
    }

    setResult(next);
    setLoading(false);

    const stored = appendHistory({
      profileId: profile().id,
      profileLabel: profile().label,
      baseUrl: baseUrl(),
      model: model(),
      systemPrompt: systemPrompts()[profile().id] ?? '',
      userMessage: userMessage(),
      lang: lang(),
      headers: sentHeaders,
      status: next.status,
      statusText: next.statusText,
      ok: next.ok,
      durationMs: next.durationMs,
      assistantText: extractAssistantText(next.responseJson),
      requestBody: next.requestBody,
      requestHeaders: next.requestHeaders,
      responseBody: next.responseBody,
      responseHeaders: next.responseHeaders,
      responseJson: next.responseJson,
      errorMessage: next.error,
    });
    setHistory(listHistory());
    setActiveHistoryId(stored.id);
  };

  const restoreFromHistory = (entry: HistoryEntry) => {
    setProfileId(entry.profileId);
    writeStorage(STORAGE.profile, entry.profileId);
    persistAndSetBase(entry.baseUrl);
    persistAndSetModel(entry.model);
    setSystemPrompts({ ...systemPrompts(), [entry.profileId]: entry.systemPrompt });
    setUserMessage(entry.userMessage);
    setSentMessage(entry.userMessage);
    setHasSent(true);
    const next = PROFILE_BY_ID[entry.profileId];
    if (next) {
      const restoredLang = (
        next.langs.includes(entry.lang as ProfileLang) ? entry.lang : next.defaultLang
      ) as ProfileLang;
      setLang(restoredLang);
      const overrideKey = `${entry.profileId}:${restoredLang}`;
      setHeaderOverrides({
        ...headerOverrides(),
        [overrideKey]: entriesFromRecord(entry.headers),
      });
    }
    setActiveHistoryId(entry.id);
    setResult({
      url: `${entry.baseUrl.replace(/\/+$/, '')}${next ? profilePath(next) : '/v1/chat/completions'}`,
      status: entry.status,
      statusText: entry.statusText,
      ok: entry.ok,
      durationMs: entry.durationMs,
      requestHeaders: entry.requestHeaders,
      requestBody: entry.requestBody,
      responseHeaders: entry.responseHeaders,
      responseBody: entry.responseBody,
      responseJson: entry.responseJson,
      error: entry.errorMessage,
    });
  };

  const handleDelete = (id: string) => {
    deleteHistory(id);
    setHistory(listHistory());
    if (activeHistoryId() === id) setActiveHistoryId(null);
  };

  const handleClear = () => {
    if (history().length === 0) return;
    if (!confirm(`Delete all ${history().length} history entries?`)) return;
    clearHistory();
    setHistory([]);
    setActiveHistoryId(null);
  };

  const handleNewRequest = () => {
    setResult(null);
    setActiveHistoryId(null);
    setHasSent(false);
    setSentMessage('');
    setSaveStatus('idle');
  };

  const handleSaveToGist = () => {
    const r = result();
    if (!r) return;
    const markdown = buildMarkdownReport(
      {
        profileLabel: profile().label,
        profileCategory: profile().category,
        systemPrompt: systemPrompts()[profile().id] ?? '',
        userMessage: sentMessage() || userMessage(),
        baseUrl: baseUrl(),
        model: model(),
        apiKey: apiKey(),
      },
      r,
    );
    setGistMarkdown(markdown);
    setGistModalOpen(true);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  return (
    <div class="app">
      <Sidebar
        entries={history()}
        activeId={activeHistoryId()}
        onSelect={restoreFromHistory}
        onDelete={handleDelete}
        onClear={handleClear}
        onNewRequest={handleNewRequest}
      />
      <div class="app__main">
        <TopBar />
        <main class="app__thread">
          <Conversation
            userMessage={sentMessage()}
            result={result()}
            loading={loading()}
            hasSent={hasSent()}
          />
        </main>
        <div class="app__composer">
          <Composer
            profiles={PROFILES}
            activeProfileId={profile().id}
            onSelectProfile={setProfileSafely}
            systemPrompt={systemPrompts()[profile().id] ?? ''}
            onSystemPromptChange={updateSystemPrompt}
            showSystemPrompt={profile().mode !== 'raw'}
            userMessage={userMessage()}
            onUserMessageChange={setUserMessage}
            headers={headerEntries()}
            onHeadersChange={updateHeaderEntries}
            onResetHeaders={resetHeaders}
            blockedHeaders={blockedHeaderNames()}
            baseUrl={baseUrl()}
            apiKey={apiKey()}
            model={model()}
            onBaseUrlChange={persistAndSetBase}
            onApiKeyChange={persistAndSetKey}
            onModelChange={persistAndSetModel}
            loading={loading()}
            onSend={handleSend}
            sdkCode={sdkCode()}
            sdkLang={lang()}
            sdkLangOptions={profile().langs}
            onSdkLangChange={setLang}
            onSdkCodeChange={onSdkCodeChange}
            sdkCodeIsEdited={sdkCodeIsEdited()}
            onResetSdkCode={resetSdkCode}
            sdkExecutable={sdkExecutable()}
            headersLocked={profile().headersLocked ?? false}
            willRunCode={willRunCode()}
            canSave={result() !== null && !loading()}
            onSaveToGist={handleSaveToGist}
            saveStatus={saveStatus()}
          />
        </div>
      </div>
      <GistModal
        open={gistModalOpen()}
        markdown={gistMarkdown()}
        onClose={() => setGistModalOpen(false)}
      />
    </div>
  );
};

export default App;
