import { useState } from 'react';
import { signUp } from '../../lib/auth-client';

interface SignupFormProps {
  onSuccess?: () => void;
}

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Basic validation
    if (!firstName.trim()) {
      setError('First name is required');
      setIsLoading(false);
      return;
    }

    if (!lastName.trim()) {
      setError('Last name is required');
      setIsLoading(false);
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUp.email({
        email,
        password,
        name: `${firstName.trim()} ${lastName.trim()}`,
      });

      if (result.error) {
        // Handle specific errors
        if (result.error.message?.includes('already exists') || result.error.message?.includes('duplicate')) {
          setError('An account with this email already exists');
        } else {
          setError(result.error.message || 'Failed to create account');
        }
        return;
      }

      // Success - redirect or call callback
      onSuccess?.();

      // Check for pending invitation to redirect to
      const pendingInvitation = sessionStorage.getItem('pendingInvitation');
      if (pendingInvitation) {
        const { token } = JSON.parse(pendingInvitation);
        window.location.href = `/accept-invite?token=${encodeURIComponent(token)}`;
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="signup-firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            First Name
          </label>
          <input
            id="signup-firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="John"
          />
        </div>
        <div>
          <label htmlFor="signup-lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Last Name
          </label>
          <input
            id="signup-lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="Doe"
          />
        </div>
      </div>

      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={4}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          placeholder="At least 4 characters"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  );
}
