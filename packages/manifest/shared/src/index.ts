// App types
export type {
  App,
  AppStatus,
  LayoutTemplate,
  LayoutAction,
  LayoutTemplateConfig,
  CreateAppRequest,
  UpdateAppRequest,
  AppWithFlows,
  AppWithFlowCount,
  DeleteAppResponse,
  IconUploadResponse,
} from './types/app.js';
export { LAYOUT_REGISTRY } from './constants/app.js';

// Flow types
export type {
  Flow,
  FlowWithApp,
  FlowWithMeta,
  FlowParameter,
  ParameterType,
  CreateFlowRequest,
  UpdateFlowRequest,
  GenerateFlowResponse,
  FlowDeletionCheck,
  DeleteFlowResponse,
} from './types/flow.js';

// Theme types
export type { ThemeVariables } from './types/theme.js';
export { DEFAULT_THEME_VARIABLES } from './constants/theme.js';

// MCP types
export type { McpToolResponse, PublishResult, ApiError, McpToolInput } from './types/mcp.js';

// Platform types
export type { PlatformStyle, ThemeMode, PreviewPreferences } from './types/platform.js';
export { DEFAULT_PREVIEW_PREFERENCES } from './constants/platform.js';

// Node types (new unified node architecture)
export type {
  Position,
  NodeType,
  NodeTypeCategory,
  NodeInstance,
  Connection,
  UINodeParameters,
  BlankComponentNodeParameters,
  ReturnNodeParameters,
  CallFlowNodeParameters,
  UserIntentNodeParameters,
  // ApiCall node types
  HttpMethod,
  HeaderEntry,
  InputMapping,
  ApiCallNodeParameters,
  // Transform node types
  JavaScriptCodeTransformParameters,
  // Link node types
  LinkNodeParameters,
  CreateNodeRequest,
  UpdateNodeRequest,
  UpdateNodePositionRequest,
  BatchPositionUpdate,
  CreateConnectionRequest,
  InsertTransformerRequest,
  InsertTransformerResponse,
  TestTransformRequest,
  TestTransformResponse,
  TestApiCallRequest,
  TestApiCallResponse,
} from './types/node.js';
export {
  isReturnNode,
  isCallFlowNode,
  isUserIntentNode,
  isApiCallNode,
  isJavaScriptCodeTransformNode,
  isLinkNode,
  isBlankComponentNode,
} from './types/node.js';

// Appearance types (for UI component visual configuration)
export type {
  AppearanceValue,
  AppearanceConfig,
  AppearanceOptionSchema,
  ComponentAppearanceSchema,
} from './types/appearance.js';
export {
  COMPONENT_APPEARANCE_REGISTRY,
  getAppearanceSchema,
  getDefaultAppearanceConfig,
} from './constants/appearance.js';

// Pagination types
export type { PaginatedResponse, PaginationQuery } from './types/pagination.js';
export { PAGINATION_DEFAULTS } from './types/pagination.js';

// Execution types
export type {
  ExecutionStatus,
  NodeExecutionStatus,
  NodeExecutionData,
  ExecutionErrorInfo,
  FlowExecution,
  ExecutionListItem,
  ExecutionListResponse,
  ExecutionListQuery,
  // Node output execution metadata
  ExecutionMetadata,
  ApiExecutionMetadata,
  TransformExecutionMetadata,
  TriggerExecutionMetadata,
  NodeOutput,
  PrimitiveOutput,
} from './types/execution.js';
export {
  hasExecutionMetadata,
  isSuccessfulExecution,
  isApiExecutionMetadata,
  extractOutputData,
  createSuccessMetadata,
  createErrorMetadata,
} from './types/execution.js';

// String utilities
export { toSnakeCase, isValidToolName } from './utils/string.js';

// Chat types (Preview LLM Chat feature)
export type {
  ToolCall,
  ToolResult,
  ChatMessageRole,
  ChatMessage,
  ModelOption,
  PreviewChatRequest,
  ChatStreamEvent,
  ModelListResponse,
  ValidateKeyRequest,
  ValidateKeyResponse,
  StoredApiKey,
} from './types/chat.js';

// Schema types (for I/O schema validation)
export type {
  JSONSchema,
  JSONSchemaType,
  CompatibilityStatus,
  CompatibilityIssueType,
  CompatibilityIssue,
  SchemaCompatibilityResult,
  SchemaState,
  NodeSchemaInfo,
  NodeSchemaResponse,
  FlowSchemasResponse,
  ValidateConnectionRequest,
  ValidateConnectionResponse,
  FlowValidationResponse,
  ConnectionValidationResult,
  NodeValidationError,
  NodeTypeSchemaResponse,
  ResolveSchemaRequest,
  ResolveSchemaResponse,
  FieldSource,
  FlattenedSchemaField,
  SuggestedTransformer,
} from './types/schema.js';

// Schema validation utilities
export {
  checkSchemaCompatibility,
  flowParametersToSchema,
  createUserIntentOutputSchema,
  validateDataAgainstSchema,
  inferSchemaFromSample,
  getAjv,
  getAjvAsync,
} from './utils/schemaValidator.js';

// Slug utilities (for human-readable node references)
export {
  toSlug,
  isValidSlug,
  generateUniqueSlug,
  getBaseSlug,
  RESERVED_SLUGS,
} from './utils/slug.js';

// Template parser utilities (for extracting variable references)
export type { TemplateReference } from './utils/templateParser.js';
export {
  parseTemplateReferences,
  groupReferencesByNode,
  getReferencedNodeSlugs,
  extractAllReferences,
  validateNodeReferences,
} from './utils/templateParser.js';

// Validation types (for code editor)
export type { ValidationError, ValidationResult } from './types/validation.js';

// Template constants (for Interface node code editor)
export {
  BLANK_COMPONENT_DEFAULT_CODE,
  getTemplateDefaultCode,
  getTemplateSampleData,
} from './constants/templates.js';

// Auth types
export type {
  AppRole,
  AppUser,
  AddUserRequest,
  UserProfile,
  PendingInvitation,
  CreateInvitationRequest,
  AcceptInvitationRequest,
  AppUserListItem,
  InvitationValidation,
  AcceptInvitationResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ChangeEmailRequest,
  ChangeEmailResponse,
  VerifyEmailChangeRequest,
  VerifyEmailChangeResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  DefaultUserCheckResponse,
} from './types/auth.js';
export { DEFAULT_ADMIN_USER } from './constants/auth.js';

// Email types
export type {
  EmailMessage,
  EmailSendResult,
  PasswordResetEmailProps,
  InvitationEmailProps,
  EmailChangeVerificationEmailProps,
  EmailTemplateProps,
  SendEmailRequest,
  EmailResultResponse,
  EmailConfigStatus,
  SendEmailOptions,
} from './types/email.js';
export { EmailTemplateType } from './types/email.js';

// Analytics types (for app execution metrics dashboard)
export type {
  AnalyticsTimeRange,
  SelectedMetric,
  ChartDataPoint,
  TrendData,
  AnalyticsMetric,
  AnalyticsMetrics,
  FlowOption,
  FlowAnalytics,
  AppAnalyticsResponse,
  AnalyticsQueryParams,
} from './types/analytics.js';
export type { TimeRangeConfig } from './types/analytics.js';
export { TIME_RANGE_LABELS, TIME_RANGE_CONFIGS } from './constants/analytics.js';

// Registry types (for UI component registry)
export type {
  RegistryResponse,
  RegistryItem,
  FileMetadata,
  ComponentDetail,
  ComponentFile,
  RegistryCategory,
  RegistryNodeParameters,
  RegistryAppearanceOption,
  RegistryFetchState,
  ComponentDetailFetchState,
  RegistryCategoryInfo,
  RegistryNodeTypeInfo,
} from './types/registry.js';

// Parameter constants (for system parameters on triggers)
export {
  USER_QUERY_PARAMETER,
  SYSTEM_PARAMETER_NAMES,
} from './constants/parameters.js';
export type { SystemParameterName } from './constants/parameters.js';

// Schema constants (for connection edge colors)
export { STATUS_COLORS, getStatusLabel } from './constants/schema.js';

// Theme editor constants (for theme variable grouping)
export type { ThemeVariableGroup } from './constants/theme-editor.js';
export { THEME_VARIABLE_GROUPS } from './constants/theme-editor.js';

// Secret types (for app secrets vault)
export type {
  AppSecret,
  CreateSecretRequest,
  UpdateSecretRequest,
  SecretListResponse,
} from './types/secret.js';
