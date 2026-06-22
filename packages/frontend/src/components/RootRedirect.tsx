import { Navigate } from '@solidjs/router';
import type { Component } from 'solid-js';

const RootRedirect: Component = () => <Navigate href="/overview" />;

export default RootRedirect;
