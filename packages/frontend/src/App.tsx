import { useLocation } from '@solidjs/router';
import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  type ParentComponent,
} from 'solid-js';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import AuthGuard from './components/AuthGuard.jsx';
import VersionIndicator from './components/VersionIndicator.jsx';
import WingmanDevTools from './components/WingmanDevTools.jsx';
import { connectSse } from './services/sse.js';

const SseConnector: ParentComponent = (props) => {
  onMount(() => {
    const cleanup = connectSse();
    onCleanup(cleanup);
  });
  return <>{props.children}</>;
};

const App: ParentComponent = (props) => {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = createSignal(false);
  const isAgentMode = () => location.pathname.startsWith('/agents/');
  const showSidebar = () => isAgentMode();

  createEffect<string | undefined>((previousPath) => {
    const currentPath = location.pathname;
    if (currentPath === previousPath) return currentPath;
    setMobileNavOpen(false);
    return currentPath;
  });

  return (
    <AuthGuard>
      <SseConnector>
        <div class="app-shell">
          <a href="#main-content" class="skip-link">
            Skip to main content
          </a>
          <Header
            showMobileNavToggle={showSidebar()}
            mobileNavOpen={mobileNavOpen()}
            onMobileNavToggle={() => setMobileNavOpen((open) => !open)}
          />
          <Show when={showSidebar()}>
            <Show when={mobileNavOpen()}>
              <button
                type="button"
                class="mobile-nav-backdrop"
                aria-label="Close navigation menu"
                onClick={() => setMobileNavOpen(false)}
              />
            </Show>
          </Show>
          <div class="app-body" classList={{ 'app-body--with-sidebar': showSidebar() }}>
            <Show when={showSidebar()}>
              <Sidebar mobileOpen={mobileNavOpen()} onNavigate={() => setMobileNavOpen(false)} />
            </Show>
            <main
              id="main-content"
              class="main-content"
              classList={{ 'main-content--full': !showSidebar() }}
              aria-label="Dashboard content"
            >
              {props.children}
            </main>
          </div>
          <VersionIndicator />
          {__DEV_MODE__ && <WingmanDevTools />}
        </div>
      </SseConnector>
    </AuthGuard>
  );
};

export default App;
