# Feature Specification: Edit Account

**Feature Branch**: `001-edit-account`
**Created**: 2026-01-10
**Status**: Draft
**Input**: User description: "Add a new page 'Edit Account' that will allow a user to edit key account values: first name, last name (stored in different columns), password (leaving empty should not change it) and email. A validation email will be sent to confirm email change. Create email using React Email following branding and layout. Standard UX. 'Edit account' link on dropdown clicking user component on sidebar bottom."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access Edit Account Page (Priority: P1)

A user wants to access their account settings. They click on their user avatar/name in the sidebar dropdown and select "Edit Account" to navigate to the account editing page.

**Why this priority**: Navigation is foundational - users cannot edit their account if they cannot find the page. This is a prerequisite for all other stories.

**Independent Test**: Can be tested by clicking user dropdown in sidebar, selecting "Edit Account", and verifying the Edit Account page loads with current user information pre-filled.

**Acceptance Scenarios**:

1. **Given** a logged-in user viewing any page, **When** they click on their user avatar/name in the sidebar, **Then** a dropdown menu appears with "Edit Account" as an option
2. **Given** the user dropdown is open, **When** they click "Edit Account", **Then** they are navigated to the Edit Account page
3. **Given** a user navigates to the Edit Account page, **When** the page loads, **Then** their current first name, last name, and email are pre-populated in the form

---

### User Story 2 - Update Personal Information (Priority: P1)

A user wants to update their first name and/or last name to correct a typo or reflect a legal name change. They navigate to the Edit Account page, modify their name fields, and save the changes. The changes are immediately reflected across the application.

**Why this priority**: Updating name information is the most common account edit operation and has no security implications. It provides immediate value with minimal complexity and risk.

**Independent Test**: Can be fully tested by changing first name from "John" to "Jonathan" and verifying the updated name appears in the sidebar user dropdown and throughout the app.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the Edit Account page, **When** they update their first name and click Save, **Then** the new first name is displayed in the sidebar user dropdown
2. **Given** a logged-in user on the Edit Account page, **When** they update both first and last name and click Save, **Then** both names are persisted and the user's initials update accordingly
3. **Given** a logged-in user on the Edit Account page, **When** they leave both name fields empty and click Save, **Then** an error message indicates that at least one name field is required

---

### User Story 3 - Change Email Address (Priority: P2)

A user needs to update their email address (e.g., switching from personal to work email). They enter a new email address, and the system sends a verification email to the new address. The email change only takes effect after the user clicks the verification link.

**Why this priority**: Email changes involve security considerations (email is used for login and password recovery). The verification flow is essential to prevent account takeover but adds complexity.

**Independent Test**: Can be tested by requesting an email change, receiving the verification email, clicking the link, and confirming the new email is now used for login.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the Edit Account page, **When** they enter a new email address and click Save, **Then** a verification email is sent to the new address and a success message indicates "Verification email sent"
2. **Given** a user has requested an email change, **When** they click the verification link in the email, **Then** their account email is updated to the new address
3. **Given** a user has requested an email change, **When** the verification link expires (after 24 hours), **Then** clicking the link shows an error and the email remains unchanged
4. **Given** a user enters an email that is already registered to another account, **When** they attempt to save, **Then** an error message indicates the email is already in use
5. **Given** a user has a pending email change, **When** they request another email change before verifying, **Then** the previous verification is invalidated and a new one is sent

---

### User Story 4 - Change Password (Priority: P3)

A user wants to update their password for security reasons. They enter their current password for verification and provide a new password. Leaving the password fields empty does not change the current password.

**Why this priority**: Password changes are less frequent than name updates but essential for security. Requiring current password verification prevents unauthorized changes if a session is compromised.

**Independent Test**: Can be tested by entering current password, setting new password, logging out, and successfully logging in with the new password.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the Edit Account page, **When** they leave all password fields empty and click Save, **Then** the password remains unchanged
2. **Given** a logged-in user on the Edit Account page, **When** they enter correct current password and a valid new password, **Then** the password is updated and a success message is displayed
3. **Given** a logged-in user on the Edit Account page, **When** they enter incorrect current password, **Then** an error message indicates "Current password is incorrect"
4. **Given** a logged-in user on the Edit Account page, **When** they enter a new password that does not meet requirements, **Then** an error message indicates the specific password requirement not met

---

### Edge Cases

- What happens when a user submits the form with no changes? System should display "No changes to save" message and not make unnecessary API calls.
- How does system handle concurrent edit attempts from multiple sessions? The most recent save wins; other sessions see updated data on next page load.
- What happens if the email verification link is accessed from a different browser/device? The link should work from any browser as long as it's valid and not expired.
- What happens if the user changes their email while a previous verification is pending? The previous verification link is invalidated; only the most recent request is valid.
- How does the system handle network errors during save? Display appropriate error message and allow retry without losing form data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store first name and last name as separate fields in the user record
- **FR-002**: System MUST allow users to update their first name independently of last name
- **FR-003**: System MUST allow users to update their last name independently of first name
- **FR-004**: System MUST require at least one of first name or last name to be non-empty
- **FR-005**: System MUST send a verification email when a user requests an email change
- **FR-006**: System MUST NOT update the user's email until the verification link is clicked
- **FR-007**: System MUST expire email verification links after 24 hours
- **FR-008**: System MUST prevent email change to an address already registered to another account
- **FR-009**: System MUST require current password verification when changing password
- **FR-010**: System MUST NOT change password if password fields are left empty
- **FR-011**: System MUST enforce password requirements: minimum 8 characters
- **FR-012**: System MUST display the "Edit Account" option in the user dropdown menu in the sidebar
- **FR-013**: System MUST pre-populate the Edit Account form with current user data
- **FR-014**: System MUST display appropriate success/error messages for all operations
- **FR-015**: System MUST use the existing React Email branding and layout components for the verification email

### Key Entities

- **User**: Represents a registered user account. Key attributes: first name, last name, email (unique), password hash. The first name and last name must be stored separately (not combined).
- **Email Verification Token**: A temporary token for validating email change requests. Key attributes: token value, new email address, user reference, expiration timestamp, used status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can update their name and see changes reflected across the application within 2 seconds of saving
- **SC-002**: 95% of email verification emails are delivered within 1 minute of request
- **SC-003**: Users can complete a name-only update in under 30 seconds (navigate, edit, save)
- **SC-004**: Users can complete a full profile update (name + email + password) in under 2 minutes
- **SC-005**: 100% of email change requests require successful verification before becoming active
- **SC-006**: Password changes require current password verification with zero exceptions
- **SC-007**: Zero unauthorized account modifications (all changes require authenticated session)

## Assumptions

- The existing better-auth library supports updating user profile fields including first name and last name
- The email service (Mailgun) is already configured and operational for sending verification emails
- The existing React Email component library (BaseLayout, Header, Button, Footer) will be reused for the verification email
- The color scheme and branding from existing email templates will be followed (Primary: #4F46E5)
- The password hashing mechanism used by better-auth will be used for password verification and updates
- The current session management allows retrieving the authenticated user's information
- Mobile responsiveness follows existing application patterns
