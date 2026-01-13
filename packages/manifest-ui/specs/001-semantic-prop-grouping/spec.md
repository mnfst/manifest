# Feature Specification: Semantic Component Prop Grouping

**Feature Branch**: `001-semantic-prop-grouping`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Component props must be grouped into semantic categories: data, actions, appearance, control"
**Reference**: [GitHub Issue #532](https://github.com/mnfst/manifest/issues/532)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Creates a New Component (Priority: P1)

As a component developer, I need to understand where to place each prop in my component's interface so that I follow the project's consistent prop organization pattern and make the component intuitive for consumers.

**Why this priority**: This is the core use case - every new component must follow the semantic grouping pattern. Without this, the entire framework loses consistency.

**Independent Test**: Can be tested by creating a new component and verifying all props are correctly grouped into the four semantic categories.

**Acceptance Scenarios**:

1. **Given** a developer is creating a new component with props for data display, **When** they define props like `items`, `title`, or `content`, **Then** these props should be placed in the `data` group.

2. **Given** a developer is creating a new component with callback handlers, **When** they define props like `onSelect`, `onChange`, or `onSubmit`, **Then** these props should be placed in the `actions` group.

3. **Given** a developer is creating a new component with styling options, **When** they define props like `variant`, `size`, or `layout`, **Then** these props should be placed in the `appearance` group.

4. **Given** a developer is creating a new component with state-related props, **When** they define props like `isLoading`, `disabled`, or `selectedValue`, **Then** these props should be placed in the `control` group.

---

### User Story 2 - AI Agent Generates Component Code (Priority: P1)

As an AI code generation agent (LLM), I need clear documentation on prop categorization rules so that I can generate component interfaces that follow the project's patterns without human intervention.

**Why this priority**: The Manifest UI is designed for AI-generated components. Consistent patterns dramatically improve code generation accuracy.

**Independent Test**: Can be tested by providing an AI agent with component requirements and verifying the generated props follow semantic grouping.

**Acceptance Scenarios**:

1. **Given** an AI agent receives a component specification, **When** it generates the TypeScript interface, **Then** props should be grouped in this exact order: `data`, `actions`, `appearance`, `control`.

2. **Given** an AI agent is generating a component with mixed prop types, **When** it encounters ambiguous props, **Then** it should apply the categorization rules consistently (e.g., `value` goes to `control` not `data` when it represents controlled state).

---

### User Story 3 - Developer Consumes an Existing Component (Priority: P2)

As a developer using components from the registry, I need predictable prop locations so that I can quickly find and configure the props I need without reading extensive documentation.

**Why this priority**: Improved developer experience leads to faster adoption and fewer configuration errors.

**Independent Test**: Can be tested by giving a developer an unfamiliar component and measuring time to find specific prop types.

**Acceptance Scenarios**:

1. **Given** a developer is using a component for the first time, **When** they need to add a click handler, **Then** they know to look in the `actions` group for `on*` props.

2. **Given** a developer is customizing a component's appearance, **When** they need to change the size or layout, **Then** they know to look in the `appearance` group.

---

### Edge Cases

- What happens when a prop could belong to multiple categories (e.g., `selectedItems` - is it data or control)?
  - **Resolution**: If the prop represents controlled state that the parent manages, it belongs in `control`. If it's read-only data passed for display, it belongs in `data`.

- How should `children` or `render` props be categorized?
  - **Resolution**: `children` is a special React prop and goes in `data` as content to display. Render props (`renderItem`, `renderHeader`) go in `appearance` as they control presentation.

- What about deprecated props or props being phased out?
  - **Resolution**: Deprecated props maintain their original category with JSDoc deprecation notices.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All component prop interfaces MUST group props into exactly four semantic categories in this order: `data`, `actions`, `appearance`, `control`.

- **FR-002**: The `data` category MUST contain props representing content the component displays, including: arrays, objects, labels, messages, text content, `children`, and static values.

- **FR-003**: The `actions` category MUST contain all callback handler props following the `on*` naming convention (e.g., `onSelect`, `onChange`, `onClick`, `onSubmit`).

- **FR-004**: The `appearance` category MUST contain props controlling visual presentation, including: `variant`, `size`, `layout`, visibility toggles, className overrides, and render props.

- **FR-005**: The `control` category MUST contain props managing component state, including: selection state, loading state (`isLoading`), disabled state, controlled values, and error states.

- **FR-006**: Each prop group MUST be documented with a JSDoc comment block indicating the group name and description.

- **FR-007**: When a prop could belong to multiple categories, the categorization MUST follow this precedence rule: controlled state takes precedence over data (e.g., `selectedValue` goes to `control`, not `data`).

- **FR-008**: This prop grouping pattern MUST be applied consistently across all existing and new components in the registry.

- **FR-009**: Documentation and code examples MUST reflect the semantic prop grouping pattern.

### Key Entities

- **Prop Category**: One of four semantic groups (`data`, `actions`, `appearance`, `control`) with specific rules for what props belong in each.

- **Component Interface**: The TypeScript type definition for a component's props, structured with clearly separated and commented prop groups.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All components in the registry follow the four-category prop grouping pattern with zero deviations.

- **SC-002**: Developers can correctly categorize a new prop in under 10 seconds using the categorization rules.

- **SC-003**: AI code generation agents produce correctly grouped interfaces 95% of the time when provided with the specification.

- **SC-004**: Component prop discoverability improves - developers find needed props 50% faster compared to unstructured interfaces.

- **SC-005**: Configuration errors during component usage decrease by 40% due to predictable prop locations.

## Assumptions

- TypeScript is used for all component interfaces, allowing for structured JSDoc comments.
- Components are React functional components using standard prop patterns.
- The registry uses consistent tooling that can enforce or lint prop ordering.
- AI agents have access to this specification when generating code.
