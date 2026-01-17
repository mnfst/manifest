import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/shadcn/tabs';

type TabType = 'login' | 'signup';

interface AuthTabsProps {
  defaultTab?: TabType;
}

export function AuthTabs({ defaultTab = 'login' }: AuthTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Sign In</TabsTrigger>
        <TabsTrigger value="signup">Sign Up</TabsTrigger>
      </TabsList>
      <TabsContent value="login" className="mt-6">
        <LoginForm />
      </TabsContent>
      <TabsContent value="signup" className="mt-6">
        <SignupForm />
      </TabsContent>
    </Tabs>
  );
}
