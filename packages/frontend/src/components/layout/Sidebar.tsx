import { useLocation } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { UserAvatar } from './UserAvatar';

/**
 * Apps icon - grid/dashboard style
 */
function AppsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Flows icon - workflow/branch style
 */
function FlowsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10 2.5a.75.75 0 01.75.75v6.19l2.97-2.97a.75.75 0 011.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0l-4.25-4.25a.75.75 0 011.06-1.06l2.97 2.97V3.25A.75.75 0 0110 2.5zm0 9.5a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0v-4a.75.75 0 01.75-.75z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Navigation sidebar component
 * Provides quick access to Apps and Flows sections
 */
export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  // Determine active section based on current route
  const isFlowsActive = pathname === '/flows' || pathname.startsWith('/flows/') ||
    pathname.includes('/flow/');
  const isAppsActive = !isFlowsActive;

  return (
    <aside className="w-56 bg-nav text-nav-foreground flex-shrink-0">
      <div className="h-full flex flex-col">
        {/* Logo/Brand */}
        <div className="h-14 px-4 flex items-center border-b border-nav-foreground/10">
          <img
            src="https://manifest.build/assets/images/logo-transparent.svg"
            alt="Manifest"
            className="h-8"
          />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1">
          <SidebarItem
            to="/"
            label="Apps"
            icon={<AppsIcon />}
            isActive={isAppsActive}
          />
          <SidebarItem
            to="/flows"
            label="Flows"
            icon={<FlowsIcon />}
            isActive={isFlowsActive}
          />
        </nav>

        {/* User Avatar at bottom */}
        <div className="p-3 border-t border-nav-foreground/10">
          <UserAvatar />
        </div>
      </div>
    </aside>
  );
}
