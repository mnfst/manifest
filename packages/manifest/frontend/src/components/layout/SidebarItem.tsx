import { Link } from 'react-router-dom';

interface SidebarItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
}

/**
 * Individual navigation item for the sidebar
 * Displays an icon and label with active state styling
 */
export function SidebarItem({ to, label, icon, isActive }: SidebarItemProps) {
  return (
    <Link
      to={to}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
        ${isActive
          ? 'bg-nav-active text-white font-medium'
          : 'text-nav-foreground hover:bg-nav-hover hover:text-white'
        }
      `}
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
