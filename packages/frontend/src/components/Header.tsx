import { A, useNavigate } from "@solidjs/router";
import { Show, createSignal, onCleanup, onMount, type Component } from "solid-js";
import { useAgentName } from "../services/routing.js";
import { authClient } from "../services/auth-client.js";
import { checkLocalMode, isLocalMode } from "../services/local-mode.js";
import { displayName } from "../services/display-name.js";

const GITHUB_REPO = "mnfst/manifest";
const STAR_DISMISSED_KEY = "github-star-dismissed";

const Header: Component = () => {
  const getAgentName = useAgentName();
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [starCount, setStarCount] = createSignal<number | null>(null);
  const [starDismissed, setStarDismissed] = createSignal(
    sessionStorage.getItem(STAR_DISMISSED_KEY) === "true"
  );
  const session = authClient.useSession();
  const navigate = useNavigate();

  onMount(() => {
    checkLocalMode();
    if (!starDismissed()) {
      fetch("/api/v1/github/stars")
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.stars === "number") {
            setStarCount(data.stars);
          }
        })
        .catch(() => {});
    }
  });

  const dismissStar = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sessionStorage.setItem(STAR_DISMISSED_KEY, "true");
    setStarDismissed(true);
  };

  const formatCount = (n: number): string => {
    return n.toLocaleString("en-US");
  };

  const user = () => session()?.data?.user;
  const effectiveName = () => {
    if (isLocalMode()) {
      const custom = displayName();
      if (custom) return custom;
    }
    return user()?.name ?? "User";
  };
  const initials = () => {
    const name = effectiveName();
    return name.charAt(0).toUpperCase();
  };

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".header__user")) {
      setMenuOpen(false);
    }
  };

  document.addEventListener("click", handleClickOutside);
  onCleanup(() => document.removeEventListener("click", handleClickOutside));

  return (
    <header class="header">
      <div class="header__left">
        <A href={isLocalMode() ? "/agents/local-agent" : "/"} class="header__logo">
          <img src="/logo.svg" alt="Manifest" class="header__logo-img header__logo-img--light" />
          <img src="/logo-white.svg" alt="Manifest" class="header__logo-img header__logo-img--dark" />
        </A>
        <Show when={!isLocalMode()}>
          <span class="header__mode-badge">Cloud</span>
        </Show>
        <Show when={isLocalMode()}>
          <span class="header__mode-badge header__mode-badge--dev">Dev</span>
        </Show>
        <Show when={getAgentName()}>
          <Show when={!isLocalMode()}>
            <span class="header__separator">/</span>
            <A href="/" class="header__breadcrumb-link">Workspace</A>
          </Show>
          <span class="header__separator">/</span>
          <span class="header__breadcrumb-current">{getAgentName()}</span>
        </Show>
      </div>
      <div class="header__right">
        <Show when={!starDismissed()}>
          <div class="header__star-separator" />
          <div class="header__github-star">
            <a
              href={`https://github.com/${GITHUB_REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              class="header__github-star-btn"
            >
              <span class="header__github-star-action">
                <svg class="header__github-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                <span class="header__github-star-label">Star</span>
              </span>
              <Show when={starCount() !== null}>
                <span class="header__github-star-count">{formatCount(starCount()!)}</span>
              </Show>
            </a>
            <button
              class="header__github-star-close"
              onClick={dismissStar}
              aria-label="Dismiss GitHub star button"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                <line x1="2" y1="2" x2="8" y2="8" />
                <line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </button>
          </div>
          <div class="header__star-separator" />
        </Show>
        <div class="header__user" style="position: relative;">
          <button
            class="header__avatar-btn"
            onClick={() => setMenuOpen(!menuOpen())}
            aria-label="User menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen()}
          >
            <div class="header__avatar">{initials()}</div>
          </button>
          <Show when={menuOpen()}>
            <div class="header__dropdown" role="menu">
              <div class="header__dropdown-header">
                <span class="header__dropdown-name">{effectiveName()}</span>
                <Show when={!isLocalMode()}>
                  <span class="header__dropdown-email">{user()?.email ?? ""}</span>
                </Show>
              </div>
              <div class="header__dropdown-divider" />
              <A href="/account" class="header__dropdown-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Account Preferences
              </A>
              <Show when={!isLocalMode()}>
                <button class="header__dropdown-item header__dropdown-item--danger" role="menuitem" onClick={handleLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Log out
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
};

export default Header;
