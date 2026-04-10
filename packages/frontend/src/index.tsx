/* @refresh reload */
import { render } from 'solid-js/web';
import { lazy } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import { MetaProvider, Title } from '@solidjs/meta';
import App from './App.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import Workspace from './pages/Workspace.jsx';
import AgentGuard from './components/AgentGuard.jsx';
import GuestGuard from './components/GuestGuard.jsx';
import NotFound from './pages/NotFound.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import type { ParentComponent } from 'solid-js';
import './styles/theme.css';

const Overview = lazy(() => import('./pages/Overview.jsx'));
const MessageLog = lazy(() => import('./pages/MessageLog.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Routing = lazy(() => import('./pages/Routing.jsx'));
const Limits = lazy(() => import('./pages/Limits.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const ModelPrices = lazy(() => import('./pages/ModelPrices.jsx'));
const Help = lazy(() => import('./pages/Help.jsx'));
const FreeModels = lazy(() => import('./pages/FreeModels.jsx'));
const ConnectProvider = lazy(() => import('./pages/ConnectProvider.jsx'));

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

render(
  () => (
    <MetaProvider>
      <Title>Manifest</Title>
      <ToastContainer />
      <Router>
        <Route path="/" component={App}>
          <Route path="/" component={Workspace} />
          <Route path="/agents/:agentName" component={AgentGuard}>
            <Route path="/" component={Overview} />
            <Route path="/messages" component={MessageLog} />
            <Route path="/settings/*" component={Settings} />
            <Route path="/routing" component={Routing} />
            <Route path="/limits" component={Limits} />
            <Route path="/model-prices" component={ModelPrices} />
            <Route path="/free-models" component={FreeModels} />

            <Route path="/help" component={Help} />
          </Route>
          <Route path="/connect-provider" component={ConnectProvider} />
          <Route path="/account" component={Account} />
        </Route>
        <Route path="/" component={GuestLayout}>
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/reset-password" component={ResetPassword} />
        </Route>
        <Route path="*404" component={NotFound} />
      </Router>
    </MetaProvider>
  ),
  root,
);
