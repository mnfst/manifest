import type { TabConfig } from '../../types/tabs';

interface TabsProps<T extends string> {
  /** Currently active tab */
  activeTab: T;
  /** Callback when tab changes */
  onTabChange: (tab: T) => void;
  /** Tab configurations */
  tabs: TabConfig[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable tabs component with support for disabled tabs
 * Uses controlled state pattern - parent manages activeTab
 */
export function Tabs<T extends string>({
  activeTab,
  onTabChange,
  tabs,
  className = '',
}: TabsProps<T>) {
  return (
    <div className={`flex border-b ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = tab.disabled === true;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id as T)}
            disabled={isDisabled}
            className={`
              relative px-4 py-2 text-sm font-medium transition-colors
              flex items-center gap-2
              ${isActive
                ? 'text-foreground'
                : isDisabled
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground'
              }
            `}
            aria-selected={isActive}
            role="tab"
          >
            {Icon && <Icon className="w-4 h-4" />}
            {tab.label}
            {/* Active indicator */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
