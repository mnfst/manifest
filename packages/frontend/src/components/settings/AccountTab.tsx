import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useAuth } from '../../hooks/useAuth';
import { api, ApiClientError } from '../../lib/api';

/**
 * Account settings tab for editing user profile
 * Displays firstName, lastName, and email fields
 */
export function AccountTab() {
  const { user, isLoading, refetch } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Track original values to detect changes
  const [originalFirstName, setOriginalFirstName] = useState('');
  const [originalLastName, setOriginalLastName] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);

  // Pre-populate form with user data
  useEffect(() => {
    if (user) {
      // Parse firstName and lastName from user.name if available
      // better-auth stores firstName/lastName separately but we may need to extract from name
      const nameParts = user.name?.split(' ') || [];
      const first = nameParts[0] || '';
      const last = nameParts.slice(1).join(' ') || '';
      setFirstName(first);
      setLastName(last);
      setOriginalFirstName(first);
      setOriginalLastName(last);
      setEmail(user.email || '');
      setOriginalEmail(user.email || '');
    }
  }, [user]);

  /**
   * Handle email change request
   */
  const handleEmailChange = async () => {
    setEmailChangeError(null);
    setEmailChangeSuccess(null);

    // Validate new email
    if (!newEmail.trim()) {
      setEmailChangeError('Please enter a new email address');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setEmailChangeError('Please enter a valid email address');
      return;
    }

    // Check if new email is different
    if (newEmail.trim().toLowerCase() === originalEmail.toLowerCase()) {
      setEmailChangeError('New email must be different from current email');
      return;
    }

    setIsChangingEmail(true);

    try {
      const result = await api.requestEmailChange({ newEmail: newEmail.trim() });
      setEmailChangeSuccess(result.message);
      setNewEmail('');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setEmailChangeError(err.message);
      } else {
        setEmailChangeError('Failed to request email change. Please try again.');
      }
    } finally {
      setIsChangingEmail(false);
    }
  };

  /**
   * Handle password change
   */
  const handlePasswordChange = async () => {
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    // Skip if both fields are empty
    if (!currentPassword.trim() && !newPassword.trim()) {
      return;
    }

    // Validate both fields are filled
    if (!currentPassword.trim()) {
      setPasswordChangeError('Please enter your current password');
      return;
    }
    if (!newPassword.trim()) {
      setPasswordChangeError('Please enter a new password');
      return;
    }

    // Validate new password length
    if (newPassword.length < 8) {
      setPasswordChangeError('New password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await api.changePassword({
        currentPassword,
        newPassword,
      });
      setPasswordChangeSuccess(result.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPasswordChangeError(err.message);
      } else {
        setPasswordChangeError('Failed to change password. Please try again.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  /**
   * Handle profile update form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validate: at least one name is required
    if (!firstName.trim() && !lastName.trim()) {
      setError('At least one of first name or last name is required');
      return;
    }

    // Check if there are any changes
    const hasNameChanges = firstName !== originalFirstName || lastName !== originalLastName;
    if (!hasNameChanges) {
      setSuccessMessage('No changes to save');
      return;
    }

    setIsSaving(true);

    try {
      await api.updateProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      // Update original values to reflect saved state
      setOriginalFirstName(firstName);
      setOriginalLastName(lastName);

      // Refresh auth context to reflect changes in sidebar
      await refetch();

      setSuccessMessage('Profile updated successfully');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <User className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium mb-2">Not Signed In</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Please sign in to edit your account settings.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-6 h-6 text-primary" />
        <h2 className="text-lg font-medium">Account Settings</h2>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Personal Information Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Personal Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter your first name"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter your last name"
              />
            </div>
          </div>
        </div>

        {/* Email Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Email Address
          </h3>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Current Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              disabled
              className="w-full px-3 py-2 border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="newEmail" className="block text-sm font-medium mb-1">
              New Email Address
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                id="newEmail"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter new email address"
                disabled={isChangingEmail}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleEmailChange}
                disabled={isChangingEmail || !newEmail.trim()}
              >
                {isChangingEmail ? 'Sending...' : 'Change Email'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A verification link will be sent to your new email address.
            </p>
          </div>

          {emailChangeError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {emailChangeError}
            </div>
          )}

          {emailChangeSuccess && (
            <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
              {emailChangeSuccess}
            </div>
          )}
        </div>

        {/* Password Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Change Password
          </h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isChangingPassword}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isChangingPassword}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                placeholder="Enter new password (min 8 characters)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to keep current password.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handlePasswordChange}
              disabled={isChangingPassword || (!currentPassword.trim() && !newPassword.trim())}
            >
              {isChangingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </div>

          {passwordChangeError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {passwordChangeError}
            </div>
          )}

          {passwordChangeSuccess && (
            <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
              {passwordChangeSuccess}
            </div>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AccountTab;
