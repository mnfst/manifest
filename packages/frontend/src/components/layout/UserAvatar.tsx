/**
 * Dummy user avatar component for POC
 * Shows a static avatar with initials and name
 */
export function UserAvatar() {
  // Hardcoded dummy user for POC
  const user = {
    name: 'Demo User',
    initials: 'DU',
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden sm:block">
        {user.name}
      </span>
      <div
        className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary"
        title={user.name}
      >
        {user.initials}
      </div>
    </div>
  );
}
