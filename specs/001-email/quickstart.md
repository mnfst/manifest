# Quickstart: Backend Email System

**Feature**: 001-email
**Date**: 2026-01-10

## Prerequisites

- Node.js >= 18.0.0
- pnpm (workspace manager)
- Mailgun account (for production sending)

## Installation

### 1. Install Dependencies

From the repository root:

```bash
# Install React Email and rendering
pnpm --filter @generator/backend add @react-email/components @react-email/render react react-dom

# Install Mailgun SDK
pnpm --filter @generator/backend add mailgun.js form-data

# Install dev dependencies
pnpm --filter @generator/backend add -D @types/react @types/react-dom
```

### 2. Configure TypeScript

Update `packages/backend/tsconfig.json` to enable JSX:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

### 3. Environment Variables

Add to `packages/backend/.env`:

```env
# Email Provider Configuration
EMAIL_PROVIDER=console          # console | mailgun
EMAIL_FROM=noreply@example.com  # Sender email address
EMAIL_FROM_NAME=Generator App   # Optional sender name

# Mailgun Configuration (required if EMAIL_PROVIDER=mailgun)
MAILGUN_API_KEY=key-xxx
MAILGUN_DOMAIN=mg.example.com
MAILGUN_EU_REGION=false         # Set to true for EU datacenter

# Application URL (for email links)
APP_URL=http://localhost:5176
```

## Usage

### Sending Password Reset Email

```typescript
import { EmailService } from './email/email.service';
import { EmailTemplateType } from '@generator/shared';

@Injectable()
export class AuthService {
  constructor(private readonly emailService: EmailService) {}

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.findUserByEmail(email);
    if (!user) return; // Silent fail to prevent enumeration

    const token = await this.generateResetToken(user.id);
    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;

    await this.emailService.send({
      to: user.email,
      template: EmailTemplateType.PASSWORD_RESET,
      props: {
        userName: user.name,
        resetLink,
        expiresIn: '1 hour',
      },
    });
  }
}
```

### Sending Invitation Email

```typescript
import { EmailService } from './email/email.service';
import { EmailTemplateType } from '@generator/shared';

@Injectable()
export class InvitationService {
  constructor(private readonly emailService: EmailService) {}

  async sendInvitation(
    inviterUserId: string,
    inviteeEmail: string,
    appId: string,
  ): Promise<void> {
    const inviter = await this.findUserById(inviterUserId);
    const app = await this.findAppById(appId);
    const inviteCode = await this.generateInviteCode(inviteeEmail, appId);

    await this.emailService.send({
      to: inviteeEmail,
      template: EmailTemplateType.INVITATION,
      props: {
        inviterName: inviter.name,
        appName: app.name,
        appLink: `${process.env.APP_URL}/invite/${inviteCode}`,
      },
    });
  }
}
```

### Preview Templates (Development)

Access email previews in your browser:

```
# Password Reset Preview
GET http://localhost:3847/api/email/preview/password-reset?userName=John&resetLink=https://example.com/reset

# Invitation Preview
GET http://localhost:3847/api/email/preview/invitation?inviterName=Jane&appName=MyApp&appLink=https://example.com/join
```

## Development Workflow

### 1. Start React Email Dev Server (Optional)

For live template editing with hot reload:

```bash
cd packages/backend
pnpm email:dev  # Starts on port 3001
```

### 2. Run Backend

```bash
pnpm --filter @generator/backend dev
```

### 3. Test Email Sending

With `EMAIL_PROVIDER=console`, emails are logged to console:

```bash
# Check backend logs for email output
[EmailService] Sending email:
  To: user@example.com
  Subject: Reset Your Password
  Template: password-reset
  --- HTML Preview ---
  <!DOCTYPE html>...
```

## Testing

### Run Tests

```bash
# Run all email tests
pnpm --filter @generator/backend test -- --testPathPattern=email

# Run with coverage
pnpm --filter @generator/backend test:cov -- --testPathPattern=email
```

### Test Structure

```
packages/backend/src/email/
├── email.service.spec.ts       # Service unit tests
├── email.controller.spec.ts    # Controller tests
├── providers/
│   └── mailgun.provider.spec.ts
└── templates/
    └── templates.spec.ts       # Template rendering tests
```

## Switching Providers

To switch from console to Mailgun:

1. Set environment variables:
   ```env
   EMAIL_PROVIDER=mailgun
   MAILGUN_API_KEY=your-api-key
   MAILGUN_DOMAIN=mg.yourdomain.com
   ```

2. Restart the backend server

No code changes required - the factory pattern handles provider switching.

## Adding New Templates

1. Create template component in `packages/backend/src/email/templates/`:

   ```tsx
   // welcome.tsx
   import { BaseLayout, Header, Footer, Button } from './components';

   interface WelcomeEmailProps {
     userName: string;
     loginLink: string;
   }

   export const WelcomeEmail = ({ userName, loginLink }: WelcomeEmailProps) => (
     <BaseLayout>
       <Header />
       <Section>
         <Heading>Welcome, {userName}!</Heading>
         <Text>Your account is ready. Click below to get started.</Text>
         <Button href={loginLink}>Go to Dashboard</Button>
       </Section>
       <Footer />
     </BaseLayout>
   );
   ```

2. Add to template type enum in `packages/shared/src/types/email.ts`:

   ```typescript
   export enum EmailTemplateType {
     PASSWORD_RESET = 'password-reset',
     INVITATION = 'invitation',
     WELCOME = 'welcome',  // Add new type
   }
   ```

3. Register in template engine (`packages/backend/src/email/templates/engine/react-email.engine.ts`):

   ```typescript
   import { WelcomeEmail } from '../welcome';

   const templates = {
     [EmailTemplateType.PASSWORD_RESET]: PasswordResetEmail,
     [EmailTemplateType.INVITATION]: InvitationEmail,
     [EmailTemplateType.WELCOME]: WelcomeEmail,  // Register new template
   };
   ```

4. Add props type to shared types:

   ```typescript
   export interface WelcomeEmailProps {
     userName: string;
     loginLink: string;
   }
   ```

## Troubleshooting

### "FormDataConstructor is not a constructor"

Add to `packages/backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "esModuleInterop": true
  }
}
```

### Emails not sending in production

1. Verify `EMAIL_PROVIDER=mailgun` is set
2. Check Mailgun API key is valid
3. Verify sending domain is verified in Mailgun dashboard
4. Check Mailgun logs for delivery issues

### Template rendering errors

1. Ensure all required props are provided
2. Check prop types match expected types
3. Review template component for syntax errors
4. Use preview endpoint to debug rendering
