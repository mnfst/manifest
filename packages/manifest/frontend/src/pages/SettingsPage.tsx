import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Key, User } from 'lucide-react';
import { Tabs } from '../components/common/Tabs';
import { ApiKeysTab } from '../components/settings/ApiKeysTab';
import { AccountTab } from '../components/settings/AccountTab';
import type { SettingsTab, SettingsTabConfig } from '../types/tabs';

/**
 * Settings page with tabbed interface
 * Mirrors the tab pattern used in FlowDetail
 */
export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromUrl || 'api-keys');

  // Sync tab state with URL
  useEffect(() => {
    if (tabFromUrl && ['api-keys', 'account'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs: SettingsTabConfig[] = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'api-keys', label: 'API Keys', icon: Key },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your application settings
          </p>
        </div>
      </div>

      {/* Tabs and Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 bg-white flex justify-center border-b">
          <Tabs activeTab={activeTab} onTabChange={handleTabChange} tabs={tabs} />
        </div>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'account' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-card rounded-lg border">
                <AccountTab />
              </div>
            </div>
          )}

          {activeTab === 'api-keys' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-card rounded-lg border">
                <ApiKeysTab />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default SettingsPage;
