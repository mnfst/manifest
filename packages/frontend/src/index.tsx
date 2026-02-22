/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { MetaProvider } from "@solidjs/meta";
import App from "./App.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import Workspace from "./pages/Workspace.jsx";
import Overview from "./pages/Overview.jsx";
import MessageLog from "./pages/MessageLog.jsx";
import Settings from "./pages/Settings.jsx";
import Routing from "./pages/Routing.jsx";
import Notifications from "./pages/Notifications.jsx";
import Account from "./pages/Account.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ModelPrices from "./pages/ModelPrices.jsx";
import Help from "./pages/Help.jsx";
import AgentGuard from "./components/AgentGuard.jsx";
import GuestGuard from "./components/GuestGuard.jsx";
import NotFound from "./pages/NotFound.jsx";
import ToastContainer from "./components/ToastContainer.jsx";
import type { ParentComponent } from "solid-js";
import "uplot/dist/uPlot.min.css";
import "./styles/theme.css";

const GuestLayout: ParentComponent = (props) => (
  <GuestGuard>
    <AuthLayout>{props.children}</AuthLayout>
  </GuestGuard>
);

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

render(
  () => (
    <MetaProvider>
      <ToastContainer />
      <Router>
        <Route path="/" component={App}>
          <Route path="/" component={Workspace} />
          <Route path="/agents/:agentName" component={AgentGuard}>
            <Route path="/" component={Overview} />
            <Route path="/messages" component={MessageLog} />
            <Route path="/settings/*" component={Settings} />
            <Route path="/routing" component={Routing} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/model-prices" component={ModelPrices} />
            <Route path="/help" component={Help} />
          </Route>
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
