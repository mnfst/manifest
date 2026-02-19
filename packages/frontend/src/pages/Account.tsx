import { createSignal, onMount, type Component } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import { authClient } from "../services/auth-client.js";

const Account: Component = () => {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [copied, setCopied] = createSignal(false);
  const [theme, setTheme] = createSignal<"light" | "dark" | "system">("system");

  const userName = () => session()?.data?.user?.name ?? "";
  const userEmail = () => session()?.data?.user?.email ?? "";
  const userId = () => session()?.data?.user?.id ?? "";

  onMount(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else {
      setTheme("system");
    }
  });

  const applyTheme = (value: "light" | "dark" | "system") => {
    setTheme(value);
    if (value === "system") {
      localStorage.removeItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      localStorage.setItem("theme", value);
      document.documentElement.classList.toggle("dark", value === "dark");
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(userId());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="account-modal">
      <Title>Account Preferences | Manifest</Title>
      <Meta name="description" content="Manage your profile, workspace, and theme preferences." />
      <div class="account-modal__inner">
        <button class="account-modal__back" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <div class="page-header">
          <div>
            <h1>Account Preferences</h1>
            <span class="breadcrumb">Manage your account, profile and preferences</span>
          </div>
        </div>

      {/* Profile Information */}
      <h3 class="settings-section__title">Profile information</h3>

      <div class="settings-card">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Display name</span>
            <span class="settings-card__label-desc">Name shown throughout the dashboard.</span>
          </div>
          <div class="settings-card__control">
            <label for="display-name" class="sr-only">Display name</label>
            <input class="settings-card__input" type="text" id="display-name" value={userName()} readonly />
          </div>
        </div>
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Email</span>
            <span class="settings-card__label-desc">Used for account notifications.</span>
          </div>
          <div class="settings-card__control">
            <label for="email" class="sr-only">Email</label>
            <input class="settings-card__input" type="email" id="email" value={userEmail()} readonly />
          </div>
        </div>
        <div class="settings-card__footer">
          <button class="btn btn--outline" style="font-size: var(--font-size-sm);">Save</button>
        </div>
      </div>

      {/* Workspace ID */}
      <h3 class="settings-section__title">Workspace</h3>

      <div class="settings-card">
        <div class="settings-card__body">
          <p class="settings-card__desc">Your unique workspace identifier. You may need this for support requests or advanced integrations.</p>
          <div class="settings-card__id-row">
            <code class="settings-card__id-value">{userId()}</code>
            <button class="settings-card__copy-btn" onClick={copyId} title="Copy">
              {copied() ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <h3 class="settings-section__title">Appearance</h3>

      <div class="settings-card">
        <div class="settings-card__body">
          <p class="settings-card__desc">Choose how Manifest looks for you.</p>
          <div class="theme-picker">
            <button
              class="theme-picker__option"
              classList={{ "theme-picker__option--active": theme() === "light" }}
              onClick={() => applyTheme("light")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              Light
            </button>
            <button
              class="theme-picker__option"
              classList={{ "theme-picker__option--active": theme() === "dark" }}
              onClick={() => applyTheme("dark")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              Dark
            </button>
            <button
              class="theme-picker__option"
              classList={{ "theme-picker__option--active": theme() === "system" }}
              onClick={() => applyTheme("system")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
              System
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
