import type { App } from '@chatgpt-app-builder/shared';
import { AppSwitcher } from './AppSwitcher';

interface HeaderProps {
  currentApp: App;
}

/**
 * Global header component for app-scoped pages
 * Shows logo, app switcher (center), and user avatar (right)
 */
export function Header({ currentApp }: HeaderProps) {
  return (
    <header className="bg-nav text-nav-foreground">
      <div className="h-14 px-4 flex items-center justify-center">
        {/* Center: App Switcher */}
        <AppSwitcher currentApp={currentApp} />
      </div>
    </header>
  );
}
