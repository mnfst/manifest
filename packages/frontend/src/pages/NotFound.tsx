import { A } from "@solidjs/router";
import { Title } from "@solidjs/meta";
import type { Component } from "solid-js";

const NotFound: Component = () => {
  return (
    <>
      <Title>404 | Manifest</Title>
      <div class="not-found">
        <span class="not-found__code">404</span>
        <h1 class="not-found__title">Page not found</h1>
        <p class="not-found__text">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <A href="/" class="not-found__link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to dashboard
        </A>
      </div>
    </>
  );
};

export default NotFound;
