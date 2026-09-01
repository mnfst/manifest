import { For, Show, type Component } from 'solid-js';
import Avatar from './Avatar.jsx';
import type { UserRef } from '../services/api/teams.js';

interface AvatarStackProps {
  /** Already ordered by the caller (most recent activity first). */
  users: UserRef[];
  /** Avatars shown before collapsing into "+n". */
  max?: number;
}

const AvatarStack: Component<AvatarStackProps> = (props) => {
  const max = () => props.max ?? 3;
  const visible = () => props.users.slice(0, max());
  const hidden = () => props.users.length - visible().length;
  const label = () => props.users.map((u) => u.name).join(', ');

  return (
    <Show
      when={props.users.length > 0}
      fallback={<span class="avatar-stack avatar-stack--empty">No users</span>}
    >
      <span class="avatar-stack" role="img" aria-label={label()}>
        <For each={visible()}>{(user) => <Avatar name={user.name} />}</For>
        <Show when={hidden() > 0}>
          <span
            class="avatar-stack__more"
            title={props.users
              .slice(max())
              .map((u) => u.name)
              .join(', ')}
          >
            +{hidden()}
          </span>
        </Show>
      </span>
    </Show>
  );
};

export default AvatarStack;
