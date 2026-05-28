/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route, Navigate } from '@solidjs/router';
import { MetaProvider, Title } from '@solidjs/meta';
import App from './App.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import AgentGuard from './components/AgentGuard.jsx';
import GuestGuard from './components/GuestGuard.jsx';
import NotFound from './pages/NotFound.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import RootRedirect from './components/RootRedirect.jsx';
import { lazyReload, clearReloadFlag } from './services/lazy-reload.js';
import type { ParentComponent } from 'solid-js';
import './styles/theme.css';

clearReloadFlag();

// Agent detail with horizontal tabs
const AgentDetail = lazyReload(() => import('./pages/AgentDetail.jsx'));
const Routing = lazyReload(() => import('./pages/Routing.jsx'));
const Settings = lazyReload(() => import('./pages/Settings.jsx'));
const AgentProviders = lazyReload(() => import('./pages/AgentProviders.jsx'));

// Global pages
const Overview = lazyReload(() => import('./pages/GlobalOverview.jsx'));
const MessageLog = lazyReload(() => import('./pages/MessageLog.jsx'));
const Subscriptions = lazyReload(() => import('./pages/providers/Subscriptions.jsx'));
const Byok = lazyReload(() => import('./pages/providers/Byok.jsx'));
const LocalProviders = lazyReload(() => import('./pages/providers/Local.jsx'));
const ConnectionDetail = lazyReload(() => import('./pages/providers/ConnectionDetail.jsx'));

// Auth / account pages
const Account = lazyReload(() => import('./pages/Account.jsx'));
const Login = lazyReload(() => import('./pages/Login.jsx'));
const Register = lazyReload(() => import('./pages/Register.jsx'));
const ResetPassword = lazyReload(() => import('./pages/ResetPassword.jsx'));
const Setup = lazyReload(() => import('./pages/Setup.jsx'));
const ConnectProvider = lazyReload(() => import('./pages/ConnectProvider.jsx'));

const GuestLayout: ParentComponent = (props) => (
  <GuestGuard>
    <AuthLayout>{props.children}</AuthLayout>
  </GuestGuard>
);

document.head.querySelector('title')?.remove();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

render(
  () => (
    <MetaProvider>
      <Title>Manifest</Title>
      <ToastContainer />
      <Router>
        <Route path="/" component={App}>
          {/* Root redirect */}
          <Route path="/" component={RootRedirect} />

          {/* Global: overview & messages (filterable by agent) */}
          <Route path="/overview" component={Overview} />
          <Route path="/messages" component={MessageLog} />

          {/* Global: providers (user-level) */}
          <Route path="/providers/subscriptions" component={Subscriptions} />
          <Route path="/providers/byok" component={Byok} />
          <Route path="/providers/local" component={LocalProviders} />
          <Route path="/providers/connections/:connectionId" component={ConnectionDetail} />
          <Route path="/providers" component={() => <Navigate href="/providers/subscriptions" />} />

          {/* Agent detail: horizontal tabs (routing, settings, providers) */}
          <Route path="/agents/:agentName" component={AgentGuard}>
            <Route path="/" component={Routing} />
            <Route path="/routing" component={Routing} />
            <Route path="/settings/*" component={Settings} />
            <Route path="/providers" component={AgentProviders} />

            {/* Redirects for removed pages */}
            <Route path="/messages" component={() => <Navigate href="/messages" />} />
            <Route path="/playground" component={() => <Navigate href="/overview" />} />
            <Route
              path="/free-models"
              component={() => <Navigate href="/providers/subscriptions" />}
            />
            <Route
              path="/model-prices"
              component={() => <Navigate href="/providers/subscriptions" />}
            />
            <Route
              path="/limits"
              component={() => {
                const agentName = window.location.pathname.split('/')[2];
                return <Navigate href={`/agents/${agentName}/settings?tab=alerts`} />;
              }}
            />
            <Route path="/help" component={() => <Navigate href="/overview" />} />
          </Route>

          <Route path="/connect-provider" component={ConnectProvider} />
          <Route path="/account" component={Account} />
        </Route>
        <Route path="/" component={GuestLayout}>
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/reset-password" component={ResetPassword} />
        </Route>
        <Route path="/setup" component={AuthLayout}>
          <Route path="/" component={Setup} />
        </Route>
        <Route path="*404" component={NotFound} />
      </Router>
    </MetaProvider>
  ),
  root,
);
