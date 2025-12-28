import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import FlowsPage from './pages/FlowsPage';
import { ConnectorsPage } from './pages/ConnectorsPage';
import AppDetail from './pages/AppDetail';
import FlowDetail from './pages/FlowDetail';
import ViewEditor from './pages/ViewEditor';
import { Sidebar } from './components/layout/Sidebar';

/**
 * Root application component with routing
 * Routes follow App → Flow → View hierarchy
 * Sidebar provides persistent navigation across all pages
 */
function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/flows" element={<FlowsPage />} />
            <Route path="/connectors" element={<ConnectorsPage />} />
            <Route path="/app/:appId" element={<AppDetail />} />
            <Route path="/app/:appId/flow/:flowId" element={<FlowDetail />} />
            <Route path="/app/:appId/flow/:flowId/view/:viewId" element={<ViewEditor />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
