import { Link } from 'react-router-dom';
import type { App } from '@chatgpt-app-builder/shared';
import { AppSwitcher } from './AppSwitcher';
import { UserAvatar } from './UserAvatar';

interface HeaderProps {
  currentApp: App;
}

/**
 * Global header component for app-scoped pages
 * Shows logo, app switcher (center), and user avatar (right)
 */
export function Header({ currentApp }: HeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="h-14 px-4 flex items-center justify-between">
        {/* Left: Logo */}
        <Link
          to="/"
          className="text-lg font-bold hover:opacity-80 transition-opacity"
        >
          Manifest
        </Link>

        {/* Center: App Switcher */}
        <div className="flex items-center">
          <AppSwitcher currentApp={currentApp} />
        </div>

        {/* Right: User Avatar */}
        <UserAvatar />
      </div>
    </header>
  );
}
