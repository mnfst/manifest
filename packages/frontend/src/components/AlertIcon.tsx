import type { Component } from 'solid-js';

interface Props {
  size?: number;
}

const AlertIcon: Component<Props> = (props) => {
  const s = () => props.size ?? 16;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={s()}
      height={s()}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.12 12.71a.4.4 0 0 1-.12-.29v-2.41c0-1.91-.75-3.69-2.13-5.02-.86-.84-1.9-1.42-3.02-1.73-.3-.73-1.01-1.24-1.85-1.24s-1.57.53-1.86 1.27C7.19 4.14 5 6.98 5 10.27v2.16c0 .11-.04.22-.12.29l-1.17 1.17a2.411 2.411 0 0 0 1.7 4.12h13.17a2.411 2.411 0 0 0 1.7-4.12l-1.17-1.17ZM18.58 16H5.41a.412.412 0 0 1-.29-.7l1.17-1.17c.46-.46.71-1.06.71-1.71v-2.16c0-2.81 2.17-5.17 4.85-5.25h.16c1.31 0 2.54.5 3.48 1.41.98.95 1.52 2.22 1.52 3.59v2.41c0 .65.25 1.25.71 1.71l1.17 1.17a.412.412 0 0 1-.29.7ZM14.82 20H9.18c.41 1.17 1.51 2 2.82 2s2.41-.83 2.82-2" />
    </svg>
  );
};

export default AlertIcon;
