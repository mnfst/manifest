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
    <div className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-full bg-nav-active flex items-center justify-center text-sm font-medium text-white"
        title={user.name}
      >
        {user.initials}
      </div>
      <span className="text-sm font-medium">
        {user.name}
      </span>
    </div>
  );
}
