/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route, Navigate } from '@solidjs/router';
import { Meta, MetaProvider, Title } from '@solidjs/meta';
import App from './App.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import Workspace from './pages/Workspace.jsx';
import RootRedirect from './components/RootRedirect.jsx';
import AgentGuard from './components/AgentGuard.jsx';
import AuthGuard from './components/AuthGuard.jsx';
import GuestGuard from './components/GuestGuard.jsx';
import NotFound from './pages/NotFound.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import { lazyReload, loadWithChunkReload } from './services/lazy-reload.js';
import { initializeI18n, t } from './i18n/index.js';
import type { ParentComponent } from 'solid-js';
import './styles/theme.css';

const GlobalOverview = lazyReload(() => import('./pages/GlobalOverview.jsx'), 'global-overview');
const AgentDetail = lazyReload(() => import('./pages/AgentDetail.jsx'), 'agent-detail');
const AgentOverview = lazyReload(() => import('./pages/AgentOverview.jsx'), 'agent-overview');
const AgentProviders = lazyReload(() => import('./pages/AgentProviders.jsx'), 'agent-providers');
const AgentLimitsRedirect = lazyReload(
  () => import('./pages/AgentLimitsRedirect.jsx'),
  'agent-limits-redirect',
);
const AgentMessagesRedirect = lazyReload(
  () => import('./pages/AgentMessagesRedirect.jsx'),
  'agent-messages-redirect',
);
const MessageLog = lazyReload(() => import('./pages/MessageLog.jsx'), 'message-log');
const Settings = lazyReload(() => import('./pages/Settings.jsx'), 'settings');
const Routing = lazyReload(() => import('./pages/Routing.jsx'), 'routing');
const Playground = lazyReload(() => import('./pages/Playground.jsx'), 'playground');
const Limits = lazyReload(() => import('./pages/Limits.jsx'), 'limits');
const Account = lazyReload(() => import('./pages/Account.jsx'), 'account');
const Upgrade = lazyReload(() => import('./pages/Upgrade.jsx'), 'upgrade');
const Login = lazyReload(() => import('./pages/Login.jsx'), 'login');
const Register = lazyReload(() => import('./pages/Register.jsx'), 'register');
const ResetPassword = lazyReload(() => import('./pages/ResetPassword.jsx'), 'reset-password');
const Setup = lazyReload(() => import('./pages/Setup.jsx'), 'setup');
const ModelPrices = lazyReload(() => import('./pages/ModelPrices.jsx'), 'model-prices');
const Help = lazyReload(() => import('./pages/Help.jsx'), 'help');
const FreeModels = lazyReload(() => import('./pages/FreeModels.jsx'), 'free-models');
const ConnectProvider = lazyReload(() => import('./pages/ConnectProvider.jsx'), 'connect-provider');
const Subscriptions = lazyReload(
  () => import('./pages/providers/Subscriptions.jsx'),
  'provider-subscriptions',
);
const Byok = lazyReload(() => import('./pages/providers/Byok.jsx'), 'provider-byok');
const LocalProviders = lazyReload(() => import('./pages/providers/Local.jsx'), 'provider-local');
const ConnectionDetail = lazyReload(
  () => import('./pages/providers/ConnectionDetail.jsx'),
  'connection-detail',
);

const GuestLayout: ParentComponent = (props) => (
  <GuestGuard>
    <AuthLayout>{props.children}</AuthLayout>
  </GuestGuard>
);

// Remove the static <title> from index.html so @solidjs/meta can manage
// document.title via its own <title> elements. The static tag is kept in
// index.html for SEO (pre-JS crawlers / Lighthouse) but must be removed
// before MetaProvider renders, otherwise the browser always picks the first
// <title> in the DOM and ignores the dynamic ones.
document.head.querySelector('title')?.remove();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}
const mountRoot = root;

async function bootstrap(): Promise<void> {
  await loadWithChunkReload(() => initializeI18n(), 'i18n-bootstrap');

  render(
    () => (
      <MetaProvider>
        <Title>Manifest</Title>
        <Meta name="description" content={t('meta.description')} />
        <Meta property="og:description" content={t('meta.description')} />
        <Meta name="twitter:description" content={t('meta.description')} />
        <ToastContainer />
        <Router>
          <Route path="/" component={App}>
            <Route path="/" component={RootRedirect} />
            <Route path="/overview" component={GlobalOverview} />
            <Route path="/messages" component={MessageLog} />
            <Route path="/harnesses" component={Workspace} />
            <Route path="/playground" component={Playground} />
            <Route path="/providers/subscriptions" component={Subscriptions} />
            <Route path="/providers/usage-based" component={Byok} />
            <Route path="/providers/local" component={LocalProviders} />
            <Route path="/providers/connections/:connectionId" component={ConnectionDetail} />
            <Route path="/harnesses/:agentName" component={AgentGuard}>
              {/* Redirects: /limits → /guardrails, /messages → global /messages */}
              <Route path="/limits" component={AgentLimitsRedirect} />
              <Route path="/messages" component={AgentMessagesRedirect} />

              {/* Tabbed shell wraps Overview / Routing / Limits / Settings */}
              <Route path="/" component={AgentDetail}>
                <Route path="/" component={AgentOverview} />
                <Route path="/overview" component={AgentOverview} />
                <Route path="/routing" component={Routing} />
                <Route path="/providers" component={AgentProviders} />
                <Route path="/guardrails" component={Limits} />
                <Route path="/settings/*" component={Settings} />
              </Route>

              {/* Non-tab agent routes: kept reachable but not primary tabs */}
              <Route path="/model-prices" component={ModelPrices} />
              <Route path="/free-models" component={FreeModels} />
              <Route path="/help" component={Help} />
            </Route>

            {/* Legacy /agents redirects → /harnesses (keep bookmarks alive) */}
            <Route
              path="/agents"
              component={() => {
                const { search, hash } = window.location;
                return <Navigate href={`/harnesses${search}${hash}`} />;
              }}
            />
            {/* The *rest splat matches zero trailing segments too, so this single
              route also covers the bare /agents/:agentName path. */}
            <Route
              path="/agents/:agentName/*rest"
              component={() => {
                const { pathname, search, hash } = window.location;
                const target = pathname.replace(/^\/agents/, '/harnesses');
                return <Navigate href={`${target}${search}${hash}`} />;
              }}
            />

            <Route path="/connect-provider" component={ConnectProvider} />
            <Route path="/account" component={Account} />
          </Route>
          <Route path="/upgrade" component={AuthGuard}>
            <Route path="/" component={Upgrade} />
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
    mountRoot,
  );
}

function renderBootstrapError(error: unknown): void {
  console.error('Failed to load the application language catalogue', error);
  const alert = document.createElement('main');
  alert.setAttribute('role', 'alert');
  alert.className = 'bootstrap-error';

  const title = document.createElement('h1');
  title.textContent = 'Manifest could not be loaded';
  const message = document.createElement('p');
  message.textContent = 'Refresh the page to try again.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Refresh';
  retry.addEventListener('click', () => window.location.reload());

  alert.append(title, message, retry);
  mountRoot.replaceChildren(alert);
}

void bootstrap().catch(renderBootstrapError);
