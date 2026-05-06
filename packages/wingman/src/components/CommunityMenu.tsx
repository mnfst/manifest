import { createSignal, For, Show, onCleanup, type Component } from 'solid-js';

const GITHUB_REPO = 'https://github.com/mnfst/manifest';
const DISCORD_INVITE = 'https://discord.gg/FepAked3W7';

interface MenuItem {
  label: string;
  href: string;
  description?: string;
}

const GITHUB_ITEMS: MenuItem[] = [
  {
    label: 'Repository',
    href: GITHUB_REPO,
    description: 'Source code, releases, and the README.',
  },
  {
    label: 'Open an issue',
    href: `${GITHUB_REPO}/issues/new/choose`,
    description: 'Report a bug or request a feature.',
  },
  {
    label: 'Start a discussion',
    href: `${GITHUB_REPO}/discussions/new`,
    description: 'Ask a question or share an idea.',
  },
  {
    label: 'Browse issues',
    href: `${GITHUB_REPO}/issues`,
  },
  {
    label: 'Browse discussions',
    href: `${GITHUB_REPO}/discussions`,
  },
  {
    label: 'Contributing guide',
    href: `${GITHUB_REPO}/blob/main/CONTRIBUTING.md`,
  },
];

const GitHubIcon: Component = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const DiscordIcon: Component = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.073.035c-.211.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.62 12.62 0 0 0-.617-1.25.077.077 0 0 0-.073-.035 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.045-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.956-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.335-.956 2.42-2.157 2.42zm7.975 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.42 2.157-2.42 1.21 0 2.176 1.096 2.157 2.42 0 1.335-.946 2.42-2.157 2.42z" />
  </svg>
);

const ChevronIcon: Component = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CommunityMenu: Component = () => {
  const [open, setOpen] = createSignal(false);

  const close = () => setOpen(false);

  const onDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.community-menu__github')) close();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  const toggle = () => {
    const next = !open();
    setOpen(next);
    if (next) {
      document.addEventListener('click', onDocumentClick);
      document.addEventListener('keydown', onKeyDown);
      onCleanup(() => {
        document.removeEventListener('click', onDocumentClick);
        document.removeEventListener('keydown', onKeyDown);
      });
    }
  };

  return (
    <div class="community-menu">
      <div class="community-menu__github" style="position: relative;">
        <button
          type="button"
          class="community-btn community-btn--pink"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open()}
        >
          <GitHubIcon />
          <span>GitHub</span>
          <ChevronIcon />
        </button>
        <Show when={open()}>
          <div class="community-dropdown" role="menu">
            <For each={GITHUB_ITEMS}>
              {(item) => (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="community-dropdown__item"
                  role="menuitem"
                  onClick={close}
                >
                  <span class="community-dropdown__label">{item.label}</span>
                  <Show when={item.description}>
                    <span class="community-dropdown__desc">{item.description}</span>
                  </Show>
                </a>
              )}
            </For>
          </div>
        </Show>
      </div>
      <a
        href={DISCORD_INVITE}
        target="_blank"
        rel="noopener noreferrer"
        class="community-btn community-btn--pink"
        title="Join the Manifest community on Discord"
      >
        <DiscordIcon />
        <span>Discord</span>
      </a>
    </div>
  );
};

export default CommunityMenu;
