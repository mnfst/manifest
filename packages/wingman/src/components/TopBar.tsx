import type { Component } from 'solid-js';
import CommunityMenu from './CommunityMenu.jsx';

const TopBar: Component = () => {
  return (
    <header class="topbar">
      <div class="topbar__brand">
        <a
          href="https://manifest.build"
          target="_blank"
          rel="noopener noreferrer"
          class="topbar__logo-link"
          title="manifest.build"
        >
          <img
            src="/logo.svg"
            alt="Manifest"
            class="topbar__logo topbar__logo--light"
            width="120"
          />
          <img
            src="/logo-white.svg"
            alt=""
            class="topbar__logo topbar__logo--dark"
            width="120"
            aria-hidden="true"
          />
        </a>
        <span class="topbar__divider" aria-hidden="true">
          /
        </span>
        <div class="topbar__title">
          <strong>Wingman</strong>
        </div>
      </div>
      <CommunityMenu />
    </header>
  );
};

export default TopBar;
