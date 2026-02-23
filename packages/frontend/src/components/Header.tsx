import { A, useNavigate } from "@solidjs/router";
import { Show, createSignal, onCleanup, onMount, type Component } from "solid-js";
import { useAgentName } from "../services/routing.js";
import { authClient } from "../services/auth-client.js";
import { checkLocalMode, isLocalMode } from "../services/local-mode.js";

const Header: Component = () => {
  const getAgentName = useAgentName();
  const [menuOpen, setMenuOpen] = createSignal(false);
  const session = authClient.useSession();
  const navigate = useNavigate();

  onMount(() => { checkLocalMode(); });

  const user = () => session()?.data?.user;
  const initials = () => {
    const u = user();
    if (!u?.name) return "?";
    return u.name.charAt(0).toUpperCase();
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
        <A href="/" class="header__logo">
          <img src="/logo.svg" alt="Manifest" class="header__logo-img header__logo-img--light" />
          <img src="/logo-white.svg" alt="Manifest" class="header__logo-img header__logo-img--dark" />
        </A>
        <Show when={!isLocalMode()}>
          <span class="header__mode-badge">Cloud</span>
        </Show>
        <Show when={getAgentName()}>
          <span class="header__separator">/</span>
          <A href="/" class="header__breadcrumb-link">Workspace</A>
          <span class="header__separator">/</span>
          <span class="header__breadcrumb-current">{getAgentName()}</span>
        </Show>
      </div>
      <div class="header__right">
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
                <span class="header__dropdown-name">{user()?.name ?? "User"}</span>
                <span class="header__dropdown-email">{user()?.email ?? ""}</span>
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
