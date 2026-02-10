import { useNavigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';

/**
 * User avatar component showing authenticated user info
 * Displays user email/initials and provides logout access
 * Uses shadcn DropdownMenu for accessibility
 */
export function UserAvatar() {
  const { user, isLoading, logout, getInitials } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-9 h-9 rounded-full bg-gray-300 dark:bg-gray-600" />
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const initials = getInitials();
  const displayName = user.name || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-3 w-full text-left text-nav-foreground hover:bg-nav-hover rounded-lg p-1 -m-1 h-auto"
        >
          <div
            className="w-9 h-9 rounded-full bg-nav-active flex items-center justify-center text-sm font-medium text-white"
            title={displayName}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium block truncate">
              {displayName}
            </span>
            {user.name && (
              <span className="text-xs text-muted-foreground block truncate">
                {user.email}
              </span>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-48">
        <DropdownMenuItem
          onClick={() => navigate('/settings?tab=account')}
        >
          <User className="mr-3 h-4 w-4 text-nav-foreground/60" />
          User Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut className="mr-3 h-4 w-4 text-nav-foreground/60" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
