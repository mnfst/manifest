import type { Component } from "solid-js";

interface Props {
  email: string;
}

const CloudEmailInfo: Component<Props> = (props) => {
  return (
    <div class="cloud-email-info">
      <svg class="cloud-email-info__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
      <div>
        <div class="cloud-email-info__title">Email alerts</div>
        <div class="cloud-email-info__desc">
          Alerts will be sent to <strong>{props.email}</strong>
        </div>
      </div>
    </div>
  );
};

export default CloudEmailInfo;
