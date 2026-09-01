import type { Component } from 'solid-js';
import { avatarColor, initials } from '../services/teams-utils.js';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Defaults to the name; pass '' to hide the tooltip. */
  title?: string;
}

/** Coloured initials, used wherever a user appears. */
const Avatar: Component<AvatarProps> = (props) => (
  <span
    class="avatar"
    classList={{ 'avatar--sm': props.size === 'sm', 'avatar--lg': props.size === 'lg' }}
    style={{ background: avatarColor(props.name) }}
    title={props.title ?? props.name}
    aria-hidden="true"
  >
    {initials(props.name)}
  </span>
);

export default Avatar;
