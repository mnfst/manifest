import type { Component } from 'solid-js';

interface Props {
  size?: number;
}

const LimitIcon: Component<Props> = (props) => {
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
      <path d="M11.5 2c-5.51 0-10 4.49-10 10s4.49 10 10 10 10-4.49 10-10-4.49-10-10-10m-8 10c0-1.85.63-3.54 1.69-4.9L16.4 18.31A8 8 0 0 1 11.5 20c-4.41 0-8-3.59-8-8m14.31 4.9L6.6 5.69A8 8 0 0 1 11.5 4c4.41 0 8 3.59 8 8 0 1.85-.63 3.54-1.69 4.9" />
    </svg>
  );
};

export default LimitIcon;
