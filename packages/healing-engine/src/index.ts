export { applyOperations, UnknownOperationError } from './applicator';
export type { ApplyResult } from './applicator';
export {
  KNOWN_OPERATION_TYPES,
  SEMANTIC_OPS,
  riskClassFor,
  isKnownOperationType,
} from './operation';
export type { Operation, OperationType } from './operation';
export { CATALOG_VERSION } from './contract';
export type {
  HealRequest,
  HealResponse,
  HealOutcomeReport,
  StructuralRequest,
  StructuralMessage,
  ProviderErrorShape,
} from './contract';
