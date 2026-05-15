import { useLocation } from '@solidjs/router';
import { onCleanup, onMount, Show, type ParentComponent } from 'solid-js';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import AuthGuard from './components/AuthGuard.jsx';
import VersionIndicator from './components/VersionIndicator.jsx';
import { connectSse } from './services/sse.js';
import { RightSidebarProvider, useRightSidebar } from './services/right-sidebar.jsx';

const SseConnector: ParentComponent = (props) => {
  onMount(() => {
    const cleanup = connectSse();
    onCleanup(cleanup);
  });
  return <>{props.children}</>;
};

const AppInner: ParentComponent = (props) => {
  const location = useLocation();
  const isAgentMode = () => location.pathname.startsWith('/agents/');
  const showSidebar = () => isAgentMode();
  const { content: rightSidebar } = useRightSidebar();

  return (
    <div class="app-shell">
      <a href="#main-content" class="skip-link">
        Skip to main content
      </a>
      <Header />
      <div class="app-body">
        <Show when={showSidebar()}>
          <Sidebar />
        </Show>
        <main
          id="main-content"
          class="main-content"
          classList={{ 'main-content--full': !showSidebar() }}
          aria-label="Dashboard content"
        >
          {props.children}
        </main>
        {rightSidebar()}
      </div>
      <VersionIndicator />
    </div>
  );
};

const App: ParentComponent = (props) => {
  return (
    <AuthGuard>
      <SseConnector>
        <RightSidebarProvider>
          <AppInner>{props.children}</AppInner>
        </RightSidebarProvider>
      </SseConnector>
    </AuthGuard>
  );
};

export default App;
