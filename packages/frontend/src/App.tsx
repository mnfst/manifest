import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import AppDetail from './pages/AppDetail';
import FlowDetail from './pages/FlowDetail';
import ViewEditor from './pages/ViewEditor';

/**
 * Root application component with routing
 * Routes follow App → Flow → View hierarchy
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app/:appId" element={<AppDetail />} />
        <Route path="/app/:appId/flow/:flowId" element={<FlowDetail />} />
        <Route path="/app/:appId/flow/:flowId/view/:viewId" element={<ViewEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
