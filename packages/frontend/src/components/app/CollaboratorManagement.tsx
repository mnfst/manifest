import { useState, useEffect, useCallback } from 'react';
import type { AppUserListItem, AppRole } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../../lib/api';
import { InviteCollaboratorModal } from './InviteCollaboratorModal';

interface CollaboratorManagementProps {
  appId: string;
}

/**
 * Collaborator management component for app owners/admins
 * Allows adding/removing collaborators and managing their roles
 */
export function CollaboratorManagement({ appId }: CollaboratorManagementProps) {
  const [users, setUsers] = useState<AppUserListItem[]>([]);
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

  // Invitation modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('admin');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Revoke invitation state
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  // Resend invitation state
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [resendSuccessId, setResendSuccessId] = useState<string | null>(null);

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
        setError('Failed to load collaborators');
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
      // Convert AppUser to AppUserListItem format
      setUsers((prev) => [...prev, { ...newUser, status: 'active' as const }]);
      setNewEmail('');
      setNewRole('admin');
    } catch (err) {
      if (err instanceof ApiClientError) {
        // Check if the user doesn't exist - show invite modal
        if (err.status === 404 && err.message.toLowerCase().includes('not found')) {
          setInviteEmail(newEmail.trim());
          setInviteRole(newRole);
          setInviteError(null);
          setShowInviteModal(true);
        } else {
          setAddError(err.message);
        }
      } else {
        setAddError('Failed to add collaborator');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleSendInvitation = async () => {
    setInviteError(null);
    setIsInviting(true);

    try {
      await api.createInvitation(appId, {
        email: inviteEmail,
        role: inviteRole,
      });
      // Close modal and clear form
      setShowInviteModal(false);
      setNewEmail('');
      setNewRole('admin');
      // Reload users to show pending invitation
      await loadUsers();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setInviteError(err.message);
      } else {
        setInviteError('Failed to send invitation');
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleCloseInviteModal = () => {
    if (!isInviting) {
      setShowInviteModal(false);
      setInviteError(null);
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

  const handleRevokeInvitation = async (invitationId: string) => {
    // Two-click confirmation
    if (revokeConfirm !== invitationId) {
      setRevokeConfirm(invitationId);
      setTimeout(() => setRevokeConfirm(null), 3000);
      return;
    }

    setRevokingInvitationId(invitationId);
    setRevokeConfirm(null);

    try {
      await api.revokeInvitation(appId, invitationId);
      setUsers((prev) => prev.filter((u) => u.id !== invitationId));
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
    } finally {
      setRevokingInvitationId(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setResendingInvitationId(invitationId);
    setResendSuccessId(null);

    try {
      await api.resendInvitation(appId, invitationId);
      setResendSuccessId(invitationId);
      // Clear success message after 3 seconds
      setTimeout(() => setResendSuccessId(null), 3000);
    } catch (err) {
      console.error('Failed to resend invitation:', err);
    } finally {
      setResendingInvitationId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading collaborators...</div>
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
      {/* Add Collaborator Form */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-3">Add Collaborator</h3>
        <form onSubmit={handleAddUser} className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AppRole)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={isAdding || !newEmail.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* Collaborators List */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-medium">
            Collaborators ({users.length})
          </h3>
        </div>
        <ul className="divide-y">
          {users.map((user) => (
            <li
              key={user.id}
              className={`flex items-center justify-between px-4 py-3 ${
                user.status === 'pending' ? 'bg-gray-50 dark:bg-gray-800/50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    user.status === 'pending'
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      : 'bg-primary/10 dark:bg-primary/20 text-primary'
                  }`}
                >
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        user.status === 'pending' ? 'text-muted-foreground' : ''
                      }`}
                    >
                      {user.name || user.email}
                    </span>
                    {user.status === 'pending' && (
                      <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        Pending Invite
                      </span>
                    )}
                    {user.status === 'active' && user.isOwner && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Owner
                      </span>
                    )}
                    {user.status === 'active' && !user.isOwner && user.role === 'admin' && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        Admin
                      </span>
                    )}
                  </div>
                  {user.status === 'active' && user.name && (
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                  {user.status === 'pending' && user.inviterName && (
                    <span className="text-xs text-muted-foreground">
                      Invited by {user.inviterName}
                    </span>
                  )}
                </div>
              </div>

              {/* Remove button - disabled for owners */}
              {user.status === 'active' && !user.isOwner && (
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

              {/* Action buttons for pending invitations */}
              {user.status === 'pending' && (
                <div className="flex items-center gap-2">
                  {/* Resend success indicator */}
                  {resendSuccessId === user.id && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Sent!
                    </span>
                  )}

                  {/* Resend button */}
                  <button
                    onClick={() => handleResendInvitation(user.id)}
                    disabled={resendingInvitationId === user.id}
                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Resend invitation email"
                  >
                    {resendingInvitationId === user.id ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Revoke button */}
                  <button
                    onClick={() => handleRevokeInvitation(user.id)}
                    disabled={revokingInvitationId === user.id}
                    className={`text-sm px-3 py-1 rounded-md transition-colors ${
                      revokeConfirm === user.id
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {revokingInvitationId === user.id
                      ? 'Revoking...'
                      : revokeConfirm === user.id
                      ? 'Click to confirm'
                      : 'Revoke'}
                  </button>
                </div>
              )}
            </li>
          ))}

          {users.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No collaborators have access to this app yet.
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

      {/* Invite Collaborator Modal */}
      <InviteCollaboratorModal
        isOpen={showInviteModal}
        email={inviteEmail}
        role={inviteRole}
        onClose={handleCloseInviteModal}
        onConfirm={handleSendInvitation}
        isLoading={isInviting}
        error={inviteError}
      />
    </div>
  );
}
