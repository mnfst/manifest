import type { Component } from "solid-js";

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
      <rect x="7" y="10" width="10" height="4" rx="1" ry="1" />
      <path d="m12,3C7.04,3,3,7.04,3,12s4.04,9,9,9,9-4.04,9-9S16.96,3,12,3Zm0,17c-4.41,0-8-3.59-8-8S7.59,4,12,4s8,3.59,8,8-3.59,8-8,8Z" />
    </svg>
  );
};

export default LimitIcon;
