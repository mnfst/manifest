<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version Change: 1.1.0 → 2.0.0 (MVP transition with production-grade requirements)
Ratification Date: 2025-12-22
Last Amended: 2026-01-19

Removed Sections:
  - POC Scope Declaration (no longer applicable)
  - "DEFERRED FOR POC" markers throughout

Modified Principles:
  - II. Testing Standards: Now mandatory (was deferred)
  - IV. Performance Requirements: Now mandatory (was deferred)
  - V. Documentation & Readability: Enhanced with community focus
  - Development Workflow: Full CI/CD requirements now active

Added Sections:
  - VI. Security Standards (new principle)
  - VII. Community & Contribution Standards (new principle)
  - Full development workflow requirements

Templates Reviewed:
  - .specify/templates/plan-template.md: ✅ Compatible (already has testing sections)
  - .specify/templates/spec-template.md: ✅ Compatible (user stories support MVP approach)
  - .specify/templates/tasks-template.md: ✅ Compatible (already has test task structure)
  - No command files found in .specify/templates/commands/

Follow-up TODOs: None
================================================================================
-->

# Generator Constitution

## MVP Quality Standards

This constitution defines the development standards for a **Minimum Viable Product (MVP)**
with production-grade quality. All code MUST meet these standards before merging.

## Core Principles

### I. Code Quality & SOLID Principles

All code MUST adhere to SOLID principles to ensure maintainability, extensibility,
and testability:

- **Single Responsibility**: Each module, class, or function MUST have one clearly
  defined purpose. If a component requires multiple reasons to change, it MUST be
  split.
- **Open/Closed**: Code MUST be open for extension but closed for modification.
  New functionality SHOULD be added through extension, not by altering existing
  working code.
- **Liskov Substitution**: Derived types MUST be substitutable for their base types
  without altering program correctness.
- **Interface Segregation**: Clients MUST NOT be forced to depend on interfaces
  they do not use. Prefer many specific interfaces over one general-purpose
  interface.
- **Dependency Inversion**: High-level modules MUST NOT depend on low-level
  modules. Both MUST depend on abstractions.

**Rationale**: SOLID principles reduce technical debt, make code easier to test,
and enable teams to work on different components without conflicts.

### II. Testing Standards

All features MUST include appropriate test coverage:

- **Unit Tests**: Every public function and method MUST have unit tests covering
  expected behavior, edge cases, and error conditions.
- **Integration Tests**: Features involving external dependencies, APIs, or
  cross-module communication MUST have integration tests.
- **Contract Tests**: APIs and service interfaces MUST have contract tests to
  verify adherence to defined specifications.
- **Test Naming**: Test names MUST clearly describe the scenario being tested
  using the pattern: `test_[unit]_[scenario]_[expected_behavior]`.
- **Test Independence**: Each test MUST be independent and MUST NOT rely on the
  execution order or state from other tests.
- **Coverage Threshold**: New code MUST maintain or improve the overall test
  coverage. Minimum 80% line coverage for new features.

**Rationale**: Comprehensive testing catches bugs early, enables safe refactoring,
and serves as living documentation of expected behavior.

### III. User Experience Consistency

All user-facing features MUST maintain consistency across the application:

- **UI Patterns**: Reuse existing UI components and patterns. New patterns MUST
  be documented and justified.
- **Error Messages**: Error messages MUST be user-friendly, actionable, and
  consistent in tone and format across the application.
- **Response Times**: User interactions MUST provide feedback within 100ms.
  Operations exceeding this threshold MUST display progress indicators.
- **Accessibility**: All UI components MUST meet WCAG 2.1 AA standards.
- **Responsive Design**: Interfaces MUST function correctly on desktop and
  tablet devices. Mobile support SHOULD be included where feasible.

**Rationale**: Consistent UX reduces user cognitive load, improves satisfaction,
and reduces support burden.

### IV. Performance Requirements

Performance MUST be considered from design through implementation:

- **Response Time Targets**: API endpoints MUST respond within 200ms at p95
  under normal load conditions.
- **Resource Efficiency**: Memory usage MUST remain stable over time with no leaks.
  CPU usage MUST be proportional to workload.
- **Optimization Discipline**: Premature optimization is prohibited. Performance
  improvements MUST be driven by profiling data, not assumptions.
- **Load Testing**: Critical paths MUST be load tested before release to verify
  performance under expected traffic patterns.

**Rationale**: Performance directly impacts user experience, operational costs,
and system reliability.

### V. Documentation & Readability

Code MUST be written for humans first, machines second:

- **Function Documentation**: Public functions MUST include documentation
  describing their purpose, parameters, return value, and any exceptions.
- **Self-Documenting Code**: Variable, function, and class names MUST be
  descriptive and intention-revealing. Avoid abbreviations unless universally
  understood.
- **Comments for Why, Not What**: Comments MUST explain reasoning and context,
  not restate what code does. If code requires a "what" comment, refactor for
  clarity.
- **Architecture Documentation**: Significant architectural decisions MUST be
  documented with rationale using ADRs or specification documents.
- **README Quality**: Each package/module MUST have a README explaining its
  purpose, setup, and basic usage.

**Rationale**: Readable, well-documented code reduces onboarding time, prevents
knowledge silos, and makes maintenance sustainable.

### VI. Security Standards

All code MUST follow security best practices:

- **Input Validation**: All external input MUST be validated and sanitized
  before processing. Never trust client-side data.
- **Authentication**: User-facing features MUST implement proper authentication.
  Sessions MUST be securely managed with appropriate timeouts.
- **Authorization**: Access control MUST be enforced at the API layer. Users
  MUST only access resources they are authorized to view or modify.
- **Secrets Management**: Secrets MUST NOT be committed to version control.
  Use environment variables or secret management services.
- **Dependency Security**: Dependencies MUST be regularly audited for known
  vulnerabilities. Critical vulnerabilities MUST be addressed within 48 hours.
- **OWASP Compliance**: Code MUST be reviewed against OWASP Top 10 vulnerabilities
  before release.

**Rationale**: Security breaches damage user trust, incur legal liability, and
can be costly to remediate. Security must be built in, not bolted on.

### VII. Community & Contribution Standards

The project MUST foster a welcoming and inclusive community:

- **Code of Conduct**: All contributors MUST adhere to the project's code of
  conduct. Respectful, constructive communication is required.
- **Contribution Guidelines**: Clear contribution guidelines MUST be maintained
  and kept up to date. New contributors SHOULD be able to make their first
  contribution within 30 minutes of reading the guidelines.
- **Issue Templates**: Bug reports and feature requests MUST use standardized
  templates to ensure consistent, actionable information.
- **PR Review Etiquette**: Code reviews MUST be constructive and educational.
  Reviewers MUST explain the reasoning behind requested changes.
- **Response Time**: Maintainers SHOULD respond to new issues and PRs within
  72 hours, even if only to acknowledge receipt.
- **Documentation for Contributors**: Setup instructions MUST work on first try.
  Common development tasks MUST be documented.

**Rationale**: A welcoming community attracts contributors, improves code quality
through diverse perspectives, and ensures project sustainability.

## Performance Standards

| Metric | Target |
|--------|--------|
| API Response Time (p95) | < 200ms |
| App Generation Time | < 15s |
| Chat Response Time | < 2s |
| Error Rate | < 0.1% |
| Test Coverage | > 80% line coverage |

## Development Workflow

### Required Quality Gates

1. **Pre-Commit**: Linting, formatting, and local tests MUST pass.
2. **Pull Request**: CI pipeline MUST complete successfully. All tests MUST pass.
3. **Pre-Merge**: Code review approval MUST be obtained from at least one maintainer.
4. **Post-Merge**: Smoke tests MUST verify deployment health.

### Auto-Serve for Testing

When a feature implementation is complete and ready for user testing, Claude MUST
automatically start the application for testing by running:

```bash
.specify/scripts/bash/serve-app.sh
```

This script will:
- Find random available ports for both backend and frontend
- Start both services in the background
- Print the URLs for the user to access
- Provide a stop command for when testing is complete

This is MANDATORY after completing any implementation task that affects the running
application. The user runs multiple instances simultaneously, so random ports are
required to avoid conflicts.

### CI/CD Requirements

- **Automated Testing**: All tests MUST run on every PR and push to main.
- **Linting**: Code style MUST be enforced automatically.
- **Security Scanning**: Dependencies MUST be scanned for vulnerabilities.
- **Build Verification**: Docker builds MUST succeed before merge.

## Governance

This constitution represents the development standards for production-grade MVP
development. All contributors MUST comply with these standards.

### Amendment Procedure

1. Proposed amendments MUST be documented with rationale.
2. Amendments MUST be reviewed by the project maintainers.
3. Breaking changes to principles require a migration plan.
4. All dependent templates MUST be updated to reflect amendments.
5. Community feedback SHOULD be solicited for major changes.

### Versioning Policy

- **MAJOR**: Backward-incompatible governance changes or principle removals.
- **MINOR**: New principles added or existing principles materially expanded.
- **PATCH**: Clarifications, wording improvements, or non-semantic refinements.

### Compliance Review

- Code reviews MUST verify compliance with constitution principles.
- Recurring issues SHOULD trigger constitution clarification or training.
- Quarterly reviews SHOULD assess whether principles remain relevant.

**Version**: 2.0.0 | **Ratified**: 2025-12-22 | **Last Amended**: 2026-01-19 | **Phase**: MVP
