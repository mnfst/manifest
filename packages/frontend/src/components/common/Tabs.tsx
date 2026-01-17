import type { TabConfig } from '../../types/tabs';
import {
  Tabs as ShadcnTabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn/tabs';

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
 * @deprecated Use shadcn Tabs directly from '@/components/ui/shadcn/tabs'
 * This wrapper is kept for backward compatibility.
 */
export function Tabs<T extends string>({
  activeTab,
  onTabChange,
  tabs,
  className = '',
}: TabsProps<T>) {
  return (
    <ShadcnTabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as T)}
      className={className}
    >
      <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2"
            >
              {Icon && <Icon className="w-4 h-4 mr-2" />}
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </ShadcnTabs>
  );
}
