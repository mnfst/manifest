import { Settings } from 'lucide-react';

/**
 * General settings tab placeholder
 * Displays "Coming soon" message for future settings
 */
export function GeneralTab() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
      <Settings className="w-12 h-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-medium mb-2">General Settings</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        General application settings will be available here in a future update.
        Check back soon for new features and customization options.
      </p>
    </div>
  );
}

export default GeneralTab;
