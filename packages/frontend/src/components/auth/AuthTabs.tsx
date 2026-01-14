import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';

type TabType = 'login' | 'signup';

interface AuthTabsProps {
  defaultTab?: TabType;
}

export function AuthTabs({ defaultTab = 'login' }: AuthTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  return (
    <div className="w-full">
      {/* Tab buttons */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('login')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'login'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => setActiveTab('signup')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'signup'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'login' ? <LoginForm /> : <SignupForm />}
      </div>
    </div>
  );
}
