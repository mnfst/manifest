import { useState, useEffect, useCallback } from 'react';
import type { AppUser, AppRole } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../../lib/api';

interface UserManagementProps {
  appId: string;
}

/**
 * User management component for app owners/admins
 * Allows adding/removing users and managing their roles
 */
export function UserManagement({ appId }: UserManagementProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add user form state
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('admin');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Remove user state
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedUsers = await api.listAppUsers(appId);
      setUsers(loadedUsers);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load users');
      }
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);

    try {
      const newUser = await api.addUserToApp(appId, {
        email: newEmail.trim(),
        role: newRole,
      });
      setUsers((prev) => [...prev, newUser]);
      setNewEmail('');
      setNewRole('admin');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setAddError(err.message);
      } else {
        setAddError('Failed to add user');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    // Two-click confirmation
    if (removeConfirm !== userId) {
      setRemoveConfirm(userId);
      setTimeout(() => setRemoveConfirm(null), 3000);
      return;
    }

    setRemovingUserId(userId);
    setRemoveConfirm(null);

    try {
      await api.removeUserFromApp(appId, userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error('Failed to remove user:', err);
    } finally {
      setRemovingUserId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
        {error}
        <button
          onClick={loadUsers}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add User Form */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-3">Add User</h3>
        <form onSubmit={handleAddUser} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AppRole)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={isAdding || !newEmail.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAdding ? 'Adding...' : 'Add'}
          </button>
        </form>
        {addError && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
            {addError}
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-medium">
            Users ({users.length})
          </h3>
        </div>
        <ul className="divide-y">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {user.name || user.email}
                    </span>
                    {user.isOwner && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Owner
                      </span>
                    )}
                    {!user.isOwner && user.role === 'admin' && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Admin
                      </span>
                    )}
                  </div>
                  {user.name && (
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Remove button - disabled for owners */}
              {!user.isOwner && (
                <button
                  onClick={() => handleRemoveUser(user.id)}
                  disabled={removingUserId === user.id}
                  className={`text-sm px-3 py-1 rounded-md transition-colors ${
                    removeConfirm === user.id
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {removingUserId === user.id
                    ? 'Removing...'
                    : removeConfirm === user.id
                    ? 'Click to confirm'
                    : 'Remove'}
                </button>
              )}
            </li>
          ))}

          {users.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No users have access to this app yet.
            </li>
          )}
        </ul>
      </div>

      {/* Confirmation message */}
      {removeConfirm && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3 text-sm dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
          Click remove again to confirm. This action cannot be undone.
          <button
            onClick={() => setRemoveConfirm(null)}
            className="ml-2 underline hover:no-underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
