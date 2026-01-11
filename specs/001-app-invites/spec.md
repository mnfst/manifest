# Feature Specification: App User Invitations

**Feature Branch**: `001-app-invites`
**Created**: 2026-01-10
**Status**: Draft
**Input**: User description: "Allow invites to apps - when adding unknown email in users tab, show modal to send invite email, display pending invites in user list with resend/remove options"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invite Non-Registered User to App (Priority: P1)

An app owner or admin wants to add a collaborator who hasn't signed up for Manifest yet. When they enter the email address and click "Add", instead of seeing an error, they are presented with an option to send an email invitation.

**Why this priority**: This is the core feature - enabling collaboration with users who haven't registered yet. Without this, the entire invitation system doesn't function.

**Independent Test**: Can be fully tested by entering a non-existent email in the Users tab, confirming the invite modal appears, sending the invite, and verifying the email is received.

**Acceptance Scenarios**:

1. **Given** an admin is on the Users tab of an app, **When** they enter an email that doesn't exist in the system and click "Add", **Then** a confirmation modal appears asking "xxx@xxx.com is not a Manifest user, would you like to send an invite by email to join [App Name]?"

2. **Given** the invite confirmation modal is displayed, **When** the user clicks "Send Invite", **Then** an invitation email is sent to the specified address and the modal closes.

3. **Given** the invite confirmation modal is displayed, **When** the user clicks "Cancel", **Then** the modal closes and no invitation is sent.

---

### User Story 2 - View Pending Invitations in User List (Priority: P1)

App owners and admins need visibility into who has been invited but hasn't yet accepted. Pending invitations should appear in the user list with a clear visual distinction.

**Why this priority**: Users need immediate feedback that their invitation was sent and is tracked. This provides confidence the system is working.

**Independent Test**: After sending an invitation, refresh the Users tab and verify the invited email appears with "Pending Invite" status.

**Acceptance Scenarios**:

1. **Given** an invitation has been sent to an email, **When** viewing the Users tab, **Then** the email appears in the user list with a "Pending Invite" indicator.

2. **Given** a pending invitation exists, **When** viewing the user list, **Then** the pending invite row is visually distinct (e.g., muted/disabled styling) from active users.

3. **Given** multiple pending invitations exist, **When** viewing the Users tab, **Then** all pending invitations are displayed, sorted after active users.

---

### User Story 3 - Revoke Pending Invitation (Priority: P2)

An admin realizes they invited the wrong email or the person is no longer joining the team. They need to cancel the pending invitation.

**Why this priority**: Essential for managing mistakes and changes in team composition, but secondary to the core invite flow.

**Independent Test**: Create a pending invitation, then click remove and verify the invitation disappears from the list.

**Acceptance Scenarios**:

1. **Given** a pending invitation exists in the user list, **When** the admin clicks the remove action, **Then** the invitation is deleted and removed from the list immediately.

2. **Given** a pending invitation has been revoked, **When** the invited user clicks the invitation link in their email, **Then** they see a message indicating the invitation is no longer valid.

---

### User Story 4 - Resend Invitation Email (Priority: P2)

The invited user didn't receive the email or it got lost. The admin needs to resend the invitation.

**Why this priority**: Important for usability but not critical to core functionality.

**Independent Test**: Create a pending invitation, click the resend icon, and verify a new email is sent.

**Acceptance Scenarios**:

1. **Given** a pending invitation exists in the user list, **When** the admin clicks the resend (mail icon) action, **Then** a new invitation email is sent to the same address.

2. **Given** an invitation email has been resent, **When** viewing the pending invitation, **Then** there is feedback confirming the email was resent (e.g., toast notification).

---

### User Story 5 - Accept Invitation and Gain App Access (Priority: P1)

A user receives an invitation email and wants to join the app. They click the link and are granted access.

**Why this priority**: This completes the invitation flow - without acceptance, invitations serve no purpose.

**Independent Test**: Send an invitation, click the acceptance link, sign up/sign in, and verify access to the app.

**Acceptance Scenarios**:

1. **Given** a user receives an invitation email, **When** they click "Accept Invitation" and they are already registered, **Then** they are signed in and redirected to the app with the assigned role.

2. **Given** a user receives an invitation email, **When** they click "Accept Invitation" and they are NOT registered, **Then** they are directed to sign up, and after completing registration, they gain access to the app.

3. **Given** an invitation has been accepted, **When** viewing the Users tab, **Then** the user appears as an active user (no longer pending).

---

### Edge Cases

- What happens when inviting an email that already has a pending invitation? System shows a message that an invitation is already pending and offers to resend.
- What happens when an invitation link is clicked after the invited email registers independently? The invitation remains valid and grants access upon acceptance.
- What happens when the same email is invited to multiple apps? Each invitation operates independently.
- How long are invitation links valid? Invitations do not expire but can be revoked.
- What happens if the app is deleted while invitations are pending? All pending invitations for that app are automatically invalidated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect when an email entered in the "Add User" form does not exist in the user database
- **FR-002**: System MUST display a confirmation modal when attempting to add a non-existent user, offering to send an email invitation
- **FR-003**: System MUST send an invitation email using the existing invitation template when the user confirms
- **FR-004**: System MUST store pending invitations with the invited email, app ID, inviter ID, assigned role, and creation timestamp
- **FR-005**: System MUST display pending invitations in the Users tab list, visually distinguished from active users
- **FR-006**: System MUST allow owners and admins to revoke (delete) pending invitations
- **FR-007**: System MUST allow owners and admins to resend invitation emails
- **FR-008**: System MUST include a unique, secure token in invitation links for acceptance
- **FR-009**: System MUST validate invitation tokens when users click acceptance links
- **FR-010**: System MUST convert pending invitations to active user-app relationships upon acceptance
- **FR-011**: System MUST automatically delete the pending invitation record after successful acceptance
- **FR-012**: System MUST prevent duplicate pending invitations for the same email-app combination
- **FR-013**: System MUST handle the case where an existing user is invited (skip invitation flow, add directly as before)

### Key Entities

- **PendingInvitation**: Represents an unaccepted invitation. Contains: invited email, app reference, inviter reference, assigned role, unique token, creation timestamp.
- **User**: Existing entity from better-auth. Referenced by inviter and (after acceptance) the invited user.
- **App**: Existing entity. The app to which access is being granted.
- **UserAppRole**: Existing entity. Created when invitation is accepted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can invite a non-registered collaborator in under 30 seconds (enter email, confirm modal, send)
- **SC-002**: 100% of pending invitations are visible in the Users tab within 1 second of being created
- **SC-003**: Invited users can complete the signup-and-accept flow in under 3 minutes
- **SC-004**: Resending an invitation takes a single click and completes within 2 seconds
- **SC-005**: Revoking an invitation immediately removes it from the list (no page refresh required)
- **SC-006**: Invitation acceptance rate can be tracked (invitations sent vs. accepted)

## Assumptions

- The existing invitation email template (`invitation.tsx`) can be adapted with minimal changes (updating the acceptance link logic)
- Invitations do not expire automatically - they remain valid until accepted or revoked
- The assigned role for invited users will default to "Admin" (matching current add-user behavior)
- Email addresses are case-insensitive for invitation matching
- The frontend will use a modal component consistent with existing modals (EditAppModal, CreateAppModal patterns)
