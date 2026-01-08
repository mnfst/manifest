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
  GenerateAppRequest,
  ChatRequest,
  ChatResponse,
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

// Connector types
export type {
  Connector,
  MySQLConnectorConfig,
  CreateConnectorRequest,
  UpdateConnectorRequest,
  DeleteConnectorResponse,
} from './types/connector.js';
export { ConnectorType, ConnectorCategory, getCategoryFromType } from './types/connector.js';

// Node types (new unified node architecture)
export type {
  Position,
  NodeType,
  NodeTypeCategory,
  NodeInstance,
  Connection,
  StatCardNodeParameters,
  ReturnNodeParameters,
  CallFlowNodeParameters,
  UserIntentNodeParameters,
  // ApiCall node types
  HttpMethod,
  HeaderEntry,
  InputMapping,
  ApiCallNodeParameters,
  CreateNodeRequest,
  UpdateNodeRequest,
  UpdateNodePositionRequest,
  BatchPositionUpdate,
  CreateConnectionRequest,
} from './types/node.js';
export {
  isStatCardNode,
  isReturnNode,
  isCallFlowNode,
  isUserIntentNode,
  isApiCallNode,
} from './types/node.js';

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
  NodeTypeSchemaResponse,
  ResolveSchemaRequest,
  ResolveSchemaResponse,
  FieldSource,
  FlattenedSchemaField,
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
  getTemplateDefaultCode,
  getTemplateSampleData,
} from './types/templates.js';
