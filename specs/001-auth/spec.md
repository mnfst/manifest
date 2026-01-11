# Feature Specification: User Authentication & Authorization

**Feature Branch**: `001-auth`
**Created**: 2026-01-10
**Status**: Draft
**Input**: User description: "Implement auth with email+password strategy, user-app relationships with roles (owner/admin), login/signup page, and user management interface"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Login (Priority: P1)

A returning user visits the application and needs to authenticate to access their apps.

**Why this priority**: Authentication is the foundational feature - without it, users cannot access any protected functionality. This is the gate to all other features.

**Independent Test**: Can be fully tested by attempting to access the home page without being logged in, being redirected to login, entering valid credentials, and gaining access to the app list.

**Acceptance Scenarios**:

1. **Given** a user is not logged in, **When** they navigate to any page in the application, **Then** they are redirected to a login/signup page with two tabs.

2. **Given** a user is on the login tab, **When** they enter valid email "admin@manifest.build" and password "admin", **Then** they are authenticated and redirected to the home page showing their apps.

3. **Given** a user is on the login tab, **When** they enter invalid credentials, **Then** they see an error message and remain on the login page.

4. **Given** a user is logged in, **When** they refresh the page or navigate directly to a protected route, **Then** they remain authenticated and see the requested page.

---

### User Story 2 - User Signup (Priority: P2)

A new user wants to create an account to start using the application.

**Why this priority**: After login works, users need the ability to create new accounts. This enables application growth and multi-user scenarios.

**Independent Test**: Can be fully tested by visiting the signup tab, creating a new account with email/password, and being logged in after successful registration.

**Acceptance Scenarios**:

1. **Given** a user is on the signup tab, **When** they enter a valid email and password and submit, **Then** a new account is created and they are automatically logged in.

2. **Given** a user attempts to sign up, **When** they enter an email that already exists, **Then** they see an error message indicating the email is already registered.

3. **Given** a user attempts to sign up, **When** they enter an invalid email format, **Then** they see a validation error.

---

### User Story 3 - Sidebar User Profile (Priority: P2)

When logged in, users see their account information in the sidebar and can access logout functionality.

**Why this priority**: Provides constant visual confirmation of authentication state and quick access to account actions. Replaces the existing dummy "Demo User" component.

**Independent Test**: Can be fully tested by logging in and verifying the sidebar shows the actual user's email/initials instead of "Demo User", and that clicking it provides logout access.

**Acceptance Scenarios**:

1. **Given** a user is logged in, **When** they view any page with the sidebar, **Then** they see their email and initials displayed at the bottom of the sidebar (replacing the dummy "Demo User").

2. **Given** a user views the sidebar user component, **When** they interact with it, **Then** they can access a logout option.

3. **Given** a user clicks logout from the sidebar, **When** the action completes, **Then** their session is terminated and they are redirected to the login page.

4. **Given** a user has logged out, **When** they try to access any protected page, **Then** they are redirected to the login page.

---

### User Story 4 - User Management for App (Priority: P3)

App owners and admins need to manage which users have access to their app.

**Why this priority**: Multi-user collaboration is important but depends on authentication and basic app access working first.

**Independent Test**: Can be fully tested by logging in as an owner/admin, navigating to the user management tab, adding a new user, and verifying they appear in the list with appropriate controls.

**Acceptance Scenarios**:

1. **Given** a user is an owner or admin of an app, **When** they view the app detail page, **Then** they see a "User Management" tab alongside existing tabs.

2. **Given** a user opens the User Management tab, **When** the page loads, **Then** they see a list of all users with access to this app, showing their email and role.

3. **Given** a user views the user list, **When** the owner user is displayed, **Then** they see the owner cannot be removed (no delete button or disabled).

4. **Given** an owner or admin is on the User Management tab, **When** they add a new user by email with a selected role (owner/admin), **Then** that user gains access to the app with the specified role.

5. **Given** an owner or admin views a non-owner user in the list, **When** they click remove, **Then** that user loses access to the app.

---

### User Story 5 - App Creation Ownership (Priority: P1)

When a user creates a new app, they automatically become the owner of that app.

**Why this priority**: Without automatic ownership assignment, users who create apps won't see them in their app list (due to role-based filtering). This is critical for the basic app creation workflow.

**Independent Test**: Can be fully tested by logging in, creating a new app, and verifying the app appears in the user's app list with the user as owner.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a new app via POST /api/apps, **Then** they are automatically assigned as the owner of that app.

2. **Given** a user has created an app, **When** they view their app list, **Then** the newly created app appears in the list.

3. **Given** a user creates an app, **When** they view the User Management tab for that app, **Then** they see themselves listed as the owner.

4. **Given** a user creates an app via the legacy /api/generate endpoint, **When** the app is created, **Then** they are also assigned as the owner.

---

### User Story 6 - Owner-Only App Deletion (Priority: P2)

Only app owners can delete apps. Admins have full access to app functionality but cannot delete the app itself.

**Why this priority**: Prevents accidental or unauthorized deletion of apps by non-owners. This is a safeguard for data integrity.

**Independent Test**: Can be fully tested by logging in as an admin (non-owner), attempting to delete an app, and verifying the operation is rejected.

**Acceptance Scenarios**:

1. **Given** a user is the owner of an app, **When** they attempt to delete the app, **Then** the deletion succeeds.

2. **Given** a user is an admin (not owner) of an app, **When** they attempt to delete the app, **Then** they receive a 403 Forbidden response.

3. **Given** a user has no role on an app, **When** they attempt to delete the app, **Then** they receive a 404 Not Found response (per security requirement SR-001).

---

### User Story 7 - Seeded Admin User (Priority: P1)

The application needs a default admin user for initial access after deployment.

**Why this priority**: Without a seeded user, no one can access the application after deployment. This is critical for first-time setup.

**Independent Test**: Can be fully tested by starting a fresh instance with an empty database and verifying "admin@manifest.build" can log in with password "admin" and is the owner of the seeded "Test App".

**Acceptance Scenarios**:

1. **Given** a fresh application instance with no users, **When** the seed process runs, **Then** a user with email "admin@manifest.build" and password "admin" is created.

2. **Given** the seed process creates the admin user, **When** the "Test App" is seeded, **Then** the admin user is assigned as "owner" of that app.

---

### Edge Cases

- What happens when a user's session expires? They are redirected to login on their next request.
- What happens when the last admin (non-owner) is removed? This succeeds; the owner always remains.
- What happens when adding a user who doesn't have an account? Display an error indicating the user must sign up first.
- What happens when a user tries to access an app they don't have permission for? They receive a 404 "Not Found" response (not 403) to prevent information leakage about resource existence.
- What happens when the owner tries to demote themselves? The owner role cannot be changed or removed.
- What happens when an unauthenticated user tries to access any protected endpoint? They receive a 401 Unauthorized response.
- What happens when a user tries to access a flow belonging to an app they don't have access to? They receive a 404 response.
- What happens when a user creates an app? They automatically become the owner.
- What happens when someone tries to add a user as "owner"? This is not allowed - each app has exactly one owner (the creator). New users can only be added as "admin".
- What happens when an admin tries to delete an app? They receive a 403 Forbidden response - only the owner can delete.
- What happens when an admin tries to add other users? This is allowed - both owners and admins can manage the user list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate users using email and password credentials.
- **FR-002**: System MUST store only minimal user data (id, email, hashed password, timestamps).
- **FR-003**: System MUST redirect unauthenticated users to a login/signup page.
- **FR-004**: System MUST display a tabbed interface (Login/Sign Up) on the authentication page.
- **FR-005**: System MUST create and maintain user sessions after successful authentication.
- **FR-006**: System MUST hash passwords before storing (never store plain text).
- **FR-007**: System MUST support user registration with email and password.
- **FR-008**: System MUST prevent duplicate email registrations.
- **FR-009**: System MUST provide a logout mechanism that terminates the user session.
- **FR-010**: System MUST replace the dummy sidebar user component with a real one showing the logged-in user's email and initials.
- **FR-011**: System MUST provide logout access from the sidebar user component.
- **FR-012**: System MUST associate users with apps through a many-to-many relationship with roles.
- **FR-013**: System MUST support exactly two roles: "owner" (exactly one per app, automatically assigned to creator) and "admin" (multiple allowed, manually assigned).
- **FR-014**: System MUST prevent removal of app owners from the user list.
- **FR-015**: System MUST display a "User Management" tab for owners and admins within app detail pages.
- **FR-016**: System MUST allow owners and admins to add users to an app by email (new users can only be added as "admin" role).
- **FR-017**: System MUST allow owners and admins to remove non-owner users from an app.
- **FR-018**: System MUST seed a default user "admin@manifest.build" with password "admin" on fresh instances.
- **FR-019**: System MUST assign the seeded admin user as "owner" of the seeded "Test App".
- **FR-020**: System MUST restrict API endpoints to authenticated users only.
- **FR-021**: System MUST only show apps that the logged-in user has access to on the home page.
- **FR-022**: System MUST use the better-auth library for authentication to keep everything self-contained and local.
- **FR-023**: System MUST automatically assign the creating user as "owner" when a new app is created.
- **FR-024**: System MUST restrict app deletion to owners only (admins cannot delete apps).
- **FR-025**: System MUST assign ownership when apps are created via any endpoint (POST /api/apps, POST /api/generate).

### Security & Privacy Requirements

- **SR-001**: System MUST return 404 (Not Found) instead of 403 (Forbidden) when a user attempts to access an app or flow they don't have permission for, to prevent information leakage about resource existence.
- **SR-002**: System MUST protect all API endpoints under `/api/*` except authentication endpoints (`/api/auth/*`).
- **SR-003**: System MUST keep MCP server endpoints (`/servers/*`) public for external MCP client access.
- **SR-004**: System MUST verify user has access to the parent app before allowing access to any flow or flow-related resources.
- **SR-005**: System MUST NOT expose any information about apps, flows, or users to unauthenticated requests (except via MCP endpoints).
- **SR-006**: System MUST validate app access on every request, not just at the route level.

### Testing Requirements

- **TR-001**: Backend MUST have unit tests for authentication guard functionality.
- **TR-002**: Backend MUST have unit tests for user-app authorization logic.
- **TR-003**: Backend MUST have integration tests verifying 404 responses for unauthorized app/flow access.
- **TR-004**: Backend MUST have tests verifying MCP endpoints remain accessible without authentication.
- **TR-005**: Backend MUST have tests verifying protected endpoints reject unauthenticated requests.

### Key Entities

- **User**: Represents an authenticated person in the system. Key attributes: unique identifier, email (unique), hashed password, creation and update timestamps.

- **UserAppRole** (Join Entity): Represents the many-to-many relationship between users and apps with a role. Key attributes: user reference, app reference, role (owner/admin).

- **App** (Existing): Already exists in the system. Will gain a relationship to users through UserAppRole.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the login process in under 5 seconds from page load to authenticated state.
- **SC-002**: Users can complete registration in under 30 seconds with minimal required fields (email, password).
- **SC-003**: 100% of protected pages redirect unauthenticated users to the login page.
- **SC-004**: Application works completely standalone without external authentication services.
- **SC-005**: Owners and admins can add or remove users from an app in under 3 clicks.
- **SC-006**: The seeded admin user can successfully log in on first deployment without any manual setup.
- **SC-007**: Users only see apps they have explicit access to (zero unauthorized app visibility).
- **SC-008**: 100% of unauthorized app/flow access attempts return 404 (not 403), preventing resource enumeration.
- **SC-009**: MCP endpoints remain fully functional without authentication for external client access.
- **SC-010**: Backend auth tests achieve >80% coverage on authentication and authorization logic.

## Assumptions

- Password requirements will follow standard web practices: minimum 4 characters for this first implementation (can be strengthened later).
- Email validation will use standard format validation.
- The authentication session will persist across browser refreshes using cookies or local storage.
- The "owner" role is immutable once assigned (owners cannot be demoted or removed).
- Adding a user requires their email to already exist in the system (they must have registered first).
- All existing apps in the database during migration will be assigned to the seeded admin user as owner.
