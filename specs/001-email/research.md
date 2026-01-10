# Research: Backend Email System

**Feature**: 001-email
**Date**: 2026-01-10
**Status**: Complete

## Research Areas

### 1. React Email + NestJS Integration

**Decision**: Use `@react-email/components` and `@react-email/render` directly with a custom NestJS service.

**Rationale**:
- Direct integration provides maximum flexibility and control
- No additional wrapper library overhead
- Follows the established pattern from [DEV Community guide](https://dev.to/drbenzene/building-a-scalable-advanced-email-templating-system-with-react-email-and-nestjs-41fd)
- Template rendering happens server-side using `render()` function from `@react-email/render`

**Alternatives Considered**:
- `@webtre/nestjs-mailer-react-adapter`: Adds abstraction on top of `@nestjs-modules/mailer`, but introduces unnecessary coupling
- `@nestixis/nestjs-mailer`: Full-featured but opinionated, harder to swap templating engine
- Custom solution with MJML: More verbose, less developer-friendly than React components

**Required Dependencies**:
```bash
pnpm add @react-email/components @react-email/render react react-dom
pnpm add -D @types/react @types/react-dom
```

**TypeScript Configuration**:
Add to `packages/backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

### 2. Mailgun Provider Integration

**Decision**: Use `mailgun.js` directly with custom provider wrapper (not `nestjs-mailgun`).

**Rationale**:
- Direct control over the API interface
- Easier to mock for testing
- Follows DIP - high-level email service depends on abstraction, not concrete Mailgun implementation
- Simpler to add alternative providers (SendGrid, SES) using same interface

**Alternatives Considered**:
- `nestjs-mailgun`: NestJS-specific wrapper, but locks you into their module pattern
- `@nextnm/nestjs-mailgun`: Similar limitations, less maintained
- `nodemailer` with Mailgun transport: Adds extra abstraction layer without benefit

**Required Dependencies**:
```bash
pnpm add mailgun.js form-data
```

**Configuration Pattern**:
```typescript
// Environment variables
MAILGUN_API_KEY=key-xxx
MAILGUN_DOMAIN=mg.example.com
MAILGUN_FROM_EMAIL=noreply@example.com
MAILGUN_EU_REGION=false  // true for EU datacenter
```

### 3. Provider Abstraction Architecture

**Decision**: Use interface-based provider abstraction with factory pattern in module.

**Rationale**:
- Follows Dependency Inversion Principle (DIP)
- Enables swapping providers via configuration (spec SC-004)
- Supports testing with mock/console providers
- Pattern established in [NestJS Email System Design guide](https://medium.com/@amitgal45)

**Interface Design**:
```typescript
interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

interface TemplateEngine {
  render<T>(template: EmailTemplateType, props: T): Promise<string>;
}
```

**Factory Pattern**:
```typescript
// email.module.ts
providers: [
  {
    provide: 'EMAIL_PROVIDER',
    useFactory: (config: ConfigService) => {
      const provider = config.get('EMAIL_PROVIDER', 'console');
      switch (provider) {
        case 'mailgun': return new MailgunProvider(config);
        case 'console': default: return new ConsoleProvider();
      }
    },
    inject: [ConfigService],
  },
]
```

### 4. Template Architecture (React Email Best Practices)

**Decision**: Modular component-based templates with shared base layout.

**Rationale**:
- Follows [React Email conventions](https://react.email/components)
- Enables consistent branding across all emails (spec FR-003)
- New email types require only content components (spec SC-007)
- Components are independently testable

**Structure**:
```
templates/
├── components/           # Shared UI components
│   ├── BaseLayout.tsx    # Html, Head, Body, Container wrapper
│   ├── Header.tsx        # Logo + app name
│   ├── Footer.tsx        # Unsubscribe links, address
│   └── Button.tsx        # CTA button styling
├── password-reset.tsx    # Uses BaseLayout + specific content
└── invitation.tsx        # Uses BaseLayout + specific content
```

**Component Composition Pattern**:
```tsx
// password-reset.tsx
export const PasswordResetEmail = ({ resetLink, userName }: Props) => (
  <BaseLayout>
    <Header />
    <Section>
      <Heading>Reset Your Password</Heading>
      <Text>Hi {userName}, click below to reset your password.</Text>
      <Button href={resetLink}>Reset Password</Button>
    </Section>
    <Footer />
  </BaseLayout>
);
```

### 5. Template Engine Abstraction

**Decision**: Abstract template rendering behind `TemplateEngine` interface.

**Rationale**:
- Enables swapping from React Email to MJML or other engines (spec SC-005)
- Decouples email service from template implementation
- Supports different rendering strategies (sync/async)

**Implementation**:
```typescript
// Template types enum
enum EmailTemplateType {
  PASSWORD_RESET = 'password-reset',
  INVITATION = 'invitation',
}

// Template engine interface
interface TemplateEngine {
  render<T extends EmailTemplateProps>(
    type: EmailTemplateType,
    props: T
  ): Promise<{ html: string; text: string }>;

  preview(type: EmailTemplateType, props: unknown): Promise<string>;
}
```

### 6. Testing Strategy

**Decision**: Unit tests with mocked providers, template rendering tests, integration tests for full flow.

**Rationale**:
- 80% coverage target (spec SC-006)
- Follows existing patterns in `packages/backend/src/app/test/`
- Mocked providers enable fast, deterministic tests
- Template tests verify HTML output structure

**Test Categories**:

1. **Unit Tests** (email.service.spec.ts):
   - Service correctly calls provider
   - Service validates email addresses
   - Service logs send attempts
   - Error handling for provider failures

2. **Provider Tests** (mailgun.provider.spec.ts):
   - Correct API call construction
   - Response parsing
   - Error handling

3. **Template Tests** (templates.spec.ts):
   - All required props render correctly
   - Layout components included
   - Links are properly formatted
   - Graceful handling of long text

4. **Integration Tests** (email.e2e-spec.ts):
   - Full send flow with console provider
   - Preview endpoint returns HTML

### 7. Development Preview

**Decision**: Dev preview endpoint + React Email dev server for template iteration.

**Rationale**:
- Spec FR-010 requires preview without sending
- React Email provides built-in dev server on port 3001
- Controller endpoint enables preview in running app

**Implementation**:
```typescript
// email.controller.ts
@Get('preview/:template')
async preview(
  @Param('template') template: EmailTemplateType,
  @Query() props: Record<string, string>,
): Promise<string> {
  return this.templateEngine.preview(template, props);
}
```

## Resolved Clarifications

| Original Unknown | Resolution | Source |
|------------------|------------|--------|
| React Email integration pattern | Direct use of @react-email/render | DEV Community guide |
| Mailgun library choice | mailgun.js with custom wrapper | DIP requirements |
| Template organization | components/ + templates in backend | React Email conventions |
| Provider switching | Factory pattern in module | NestJS best practices |
| Testing approach | Unit + template + integration | Existing codebase patterns |

## Sources

- [Building A Scalable Advanced Email Templating System with React Email and NestJS](https://dev.to/drbenzene/building-a-scalable-advanced-email-templating-system-with-react-email-and-nestjs-41fd)
- [React Email Components](https://react.email/components)
- [React Email GitHub](https://github.com/resend/react-email)
- [NestJS Email System Design (SOLID principles)](https://medium.com/@amitgal45)
- [nestjs-mailgun npm](https://www.npmjs.com/package/nestjs-mailgun)
