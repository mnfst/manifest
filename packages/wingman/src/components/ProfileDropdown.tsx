import { createSignal, For, onCleanup, Show, type Component } from 'solid-js';
import type { Profile } from '../profiles';

interface Props {
  profiles: readonly Profile[];
  activeId: string;
  onSelect: (id: string) => void;
}

const ChevronIcon: Component = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon: Component = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ProfileDropdown: Component<Props> = (props) => {
  const [open, setOpen] = createSignal(false);

  const active = () => props.profiles.find((p) => p.id === props.activeId) ?? props.profiles[0]!;

  const close = () => setOpen(false);

  const onDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.profile-dd')) close();
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

  const handleSelect = (id: string) => {
    props.onSelect(id);
    close();
  };

  return (
    <div class="profile-dd">
      <button
        type="button"
        class="profile-dd__btn"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open()}
      >
        <img class="profile-dd__icon" src={active().icon} alt="" width="22" height="22" />
        <span class="profile-dd__label">{active().label}</span>
        <span class="profile-dd__category">
          {active().category === 'personal'
            ? 'Personal agent'
            : active().category === 'app'
              ? 'App SDK'
              : 'Raw'}
        </span>
        <ChevronIcon />
      </button>
      <Show when={open()}>
        <div class="profile-dd__menu" role="listbox" aria-label="Choose agent profile">
          <For each={props.profiles}>
            {(p) => (
              <button
                type="button"
                class="profile-dd__item"
                classList={{ 'profile-dd__item--active': p.id === props.activeId }}
                role="option"
                aria-selected={p.id === props.activeId}
                onClick={() => handleSelect(p.id)}
              >
                <img class="profile-dd__item-icon" src={p.icon} alt="" width="22" height="22" />
                <span class="profile-dd__item-body">
                  <span class="profile-dd__item-line">
                    <span class="profile-dd__item-label">{p.label}</span>
                    <span class="profile-dd__item-tag">
                      {p.category === 'personal' ? 'Agent' : p.category === 'app' ? 'SDK' : 'Raw'}
                    </span>
                  </span>
                  <span class="profile-dd__item-blurb">{p.blurb}</span>
                </span>
                <Show when={p.id === props.activeId}>
                  <span class="profile-dd__item-check" aria-hidden="true">
                    <CheckIcon />
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default ProfileDropdown;
