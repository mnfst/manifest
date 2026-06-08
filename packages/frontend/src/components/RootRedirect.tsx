import { Navigate } from '@solidjs/router';
import type { Component } from 'solid-js';

/** Root `/` redirects to the Overview hub page. */
const RootRedirect: Component = () => {
  return <Navigate href="/overview" />;
};

export default RootRedirect;
