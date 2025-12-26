import type { App, LayoutTemplate, MockData } from '@chatgpt-app-builder/shared';
import { DEFAULT_TABLE_MOCK_DATA } from '@chatgpt-app-builder/shared';
import { ThemeProvider } from './ThemeProvider';
import { LayoutRenderer } from './LayoutRenderer';

interface VisualDisplayProps {
  app: App;
  /** Layout template - passed separately in new architecture (from View) */
  layoutTemplate?: LayoutTemplate;
  /** Mock data - passed separately in new architecture (from View) */
  mockData?: MockData;
  /** Tool name - passed separately in new architecture (from Flow) */
  toolName?: string;
  isDarkMode?: boolean;
}

/**
 * Visual display panel showing the current app/view configuration
 * Renders the selected layout with theme variables and mock data
 * @deprecated This component will be replaced by ViewDisplay in the new architecture
 */
export function VisualDisplay({
  app,
  layoutTemplate = 'table',
  mockData = DEFAULT_TABLE_MOCK_DATA,
  toolName,
  isDarkMode = false
}: VisualDisplayProps) {
  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* App info header */}
      <div className={`px-4 py-3 border-b ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{app.name}</h2>
            {app.description && (
              <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{app.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}>
              {layoutTemplate}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              app.status === 'published'
                ? 'bg-green-500/20 text-green-400'
                : isDarkMode
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-amber-100 text-amber-700'
            }`}>
              {app.status}
            </span>
          </div>
        </div>
      </div>

      {/* Layout preview */}
      <div className="flex-1 overflow-auto p-4">
        <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white border'}`}>
          <ThemeProvider themeVariables={app.themeVariables} isDarkMode={isDarkMode}>
            <LayoutRenderer
              layoutTemplate={layoutTemplate}
              mockData={mockData}
              isDarkMode={isDarkMode}
            />
          </ThemeProvider>
        </div>
      </div>

      {/* Tool info footer */}
      {toolName && (
        <div className={`px-4 py-2 border-t ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>MCP Tool:</span>
              <code className={`px-2 py-0.5 rounded font-mono text-xs ${
                isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
              }`}>{toolName}</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
