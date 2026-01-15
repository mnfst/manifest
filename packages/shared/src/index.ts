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
export { LAYOUT_REGISTRY } from './types/app.js';

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
export { DEFAULT_THEME_VARIABLES } from './types/theme.js';

// MCP types
export type { McpToolResponse, PublishResult, ApiError, McpToolInput } from './types/mcp.js';

// Platform types
export type { PlatformStyle, ThemeMode, PreviewPreferences } from './types/platform.js';
export { DEFAULT_PREVIEW_PREFERENCES } from './types/platform.js';

// Node types (new unified node architecture)
export type {
  Position,
  NodeType,
  NodeTypeCategory,
  NodeInstance,
  Connection,
  UINodeParameters,
  StatCardNodeParameters,
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
} from './types/node.js';
export {
  isStatCardNode,
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
} from './types/appearance.js';

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

// Template types (for Interface node code editor)
export type { TemplateDefinition } from './types/templates.js';
export {
  TEMPLATE_DEFINITIONS,
  TABLE_SAMPLE_DATA,
  POST_LIST_SAMPLE_DATA,
  TABLE_DEFAULT_CODE,
  POST_LIST_DEFAULT_CODE,
  BLANK_COMPONENT_DEFAULT_CODE,
  BLANK_COMPONENT_SAMPLE_DATA,
  getTemplateDefaultCode,
  getTemplateSampleData,
} from './types/templates.js';

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
export { DEFAULT_ADMIN_USER } from './types/auth.js';

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
} from './types/email.js';
export { EmailTemplateType } from './types/email.js';

// Analytics types (for app execution metrics dashboard)
export type {
  AnalyticsTimeRange,
  ChartDataPoint,
  TrendData,
  AnalyticsMetric,
  AnalyticsMetrics,
  FlowOption,
  AppAnalyticsResponse,
  AnalyticsQueryParams,
} from './types/analytics.js';
export { TIME_RANGE_LABELS } from './types/analytics.js';

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
