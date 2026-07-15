/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route, Navigate } from '@solidjs/router';
import { MetaProvider, Title } from '@solidjs/meta';
import App from './App.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import Workspace from './pages/Workspace.jsx';
import RootRedirect from './components/RootRedirect.jsx';
import AgentGuard from './components/AgentGuard.jsx';
import AutofixCohortGate from './components/AutofixCohortGate.jsx';
import AuthGuard from './components/AuthGuard.jsx';
import GuestGuard from './components/GuestGuard.jsx';
import NotFound from './pages/NotFound.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import { lazyReload, clearReloadFlag } from './services/lazy-reload.js';
import type { ParentComponent } from 'solid-js';
import './styles/theme.css';

clearReloadFlag();

const GlobalOverview = lazyReload(() => import('./pages/GlobalOverview.jsx'));
const AgentDetail = lazyReload(() => import('./pages/AgentDetail.jsx'));
const AgentOverview = lazyReload(() => import('./pages/AgentOverview.jsx'));
const AgentProviders = lazyReload(() => import('./pages/AgentProviders.jsx'));
const AgentLimitsRedirect = lazyReload(() => import('./pages/AgentLimitsRedirect.jsx'));
const AgentMessagesRedirect = lazyReload(() => import('./pages/AgentMessagesRedirect.jsx'));
const MessageLog = lazyReload(() => import('./pages/MessageLog.jsx'));
const Settings = lazyReload(() => import('./pages/Settings.jsx'));
const Routing = lazyReload(() => import('./pages/Routing.jsx'));
const Playground = lazyReload(() => import('./pages/Playground.jsx'));
const Limits = lazyReload(() => import('./pages/Limits.jsx'));
const Account = lazyReload(() => import('./pages/Account.jsx'));
const Upgrade = lazyReload(() => import('./pages/Upgrade.jsx'));
const Login = lazyReload(() => import('./pages/Login.jsx'));
const Register = lazyReload(() => import('./pages/Register.jsx'));
const ResetPassword = lazyReload(() => import('./pages/ResetPassword.jsx'));
const Setup = lazyReload(() => import('./pages/Setup.jsx'));
const ModelPrices = lazyReload(() => import('./pages/ModelPrices.jsx'));
const Help = lazyReload(() => import('./pages/Help.jsx'));
const FreeModels = lazyReload(() => import('./pages/FreeModels.jsx'));
const ConnectProvider = lazyReload(() => import('./pages/ConnectProvider.jsx'));
const Subscriptions = lazyReload(() => import('./pages/providers/Subscriptions.jsx'));
const Byok = lazyReload(() => import('./pages/providers/Byok.jsx'));
const LocalProviders = lazyReload(() => import('./pages/providers/Local.jsx'));
const ConnectionDetail = lazyReload(() => import('./pages/providers/ConnectionDetail.jsx'));

const GuestLayout: ParentComponent = (props) => (
  <GuestGuard>
    <AuthLayout>{props.children}</AuthLayout>
  </GuestGuard>
);

// Single conditional entry point for the Auto-fix beta UI. Eligible tenants (the
// backend early-access cohort) get the redesigned global overview; everyone else
// keeps the current one. The redesigned overview lands via #2485 — until then
// both branches render the existing GlobalOverview, so no eligible tenant sees a
// regression while the cohort gate is in place.
// TODO(#2485): replace the eligible branch (children) with the redesigned overview.
const OverviewRoute: ParentComponent = () => (
  <AutofixCohortGate fallback={<GlobalOverview />}>
    <GlobalOverview />
  </AutofixCohortGate>
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

render(
  () => (
    <MetaProvider>
      <Title>Manifest</Title>
      <ToastContainer />
      <Router>
        <Route path="/" component={App}>
          <Route path="/" component={RootRedirect} />
          <Route path="/overview" component={OverviewRoute} />
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
  root,
);
