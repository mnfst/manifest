import { Link } from 'react-router-dom';
import type { FlowWithApp } from '@chatgpt-app-builder/shared';

interface FlowCardWithAppProps {
  flow: FlowWithApp;
}

/**
 * Flow card component that displays the parent app context
 * Used in the cross-app flows listing page
 */
export function FlowCardWithApp({ flow }: FlowCardWithAppProps) {
  const viewCount = flow.views?.length ?? 0;

  return (
    <Link
      to={`/app/${flow.appId}/flow/${flow.id}`}
      className="block bg-card rounded-lg border hover:border-primary/50 hover:shadow-md transition-all"
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Flow info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {flow.name}
            </h3>

            {/* Parent app badge */}
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M3.75 2a.75.75 0 00-.75.75v10.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75V6.636a.75.75 0 00-.22-.53L9.22 2.47a.75.75 0 00-.53-.22H3.75z" clipRule="evenodd" />
                </svg>
                {flow.app.name}
              </span>
            </div>

            {flow.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {flow.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                </svg>
                {viewCount} view{viewCount !== 1 ? 's' : ''}
              </span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                {flow.toolName}
              </code>
              {!flow.isActive && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                  Inactive
                </span>
              )}
            </div>
          </div>

          {/* Arrow icon */}
          <div className="flex-shrink-0 mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-muted-foreground">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
