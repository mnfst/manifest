import entitySchema from './schema/definitions/entity-schema.json'
import propertyOptionsSchema from './schema/definitions/property-options-schema.json'
import choiceOptionsSchema from './schema/definitions/property-options/choice-options-schema.json'
import moneyOptionsSchema from './schema/definitions/property-options/money-options-schema.json'
import imageOptionsSchema from './schema/definitions/property-options/image-options-schema.json'
import propertySchema from './schema/definitions/property-schema.json'
import relationshipSchema from './schema/definitions/relationship-schema.json'
import validationSchema from './schema/definitions/validation-schema.json'
import manifestSchema from './schema/schema.json'
import policiesSchema from './schema/definitions/policies/policies-schema.json'
import policySchema from './schema/definitions/policies/policy-schema.json'
import hooksSchema from './schema/definitions/hooks/hooks-schema.json'
import hookSchema from './schema/definitions/hooks/hook-schema.json'
import endpointSchema from './schema/definitions/endpoint-schema.json'
import middlewareSchema from './schema/definitions/middlewares/middleware-schema.json'
import middlewaresSchema from './schema/definitions/middlewares/middlewares-schema.json'

export default [
  manifestSchema,
  entitySchema,
  propertySchema,
  relationshipSchema,
  validationSchema,
  propertyOptionsSchema,

  // Property options.
  choiceOptionsSchema,
  moneyOptionsSchema,
  imageOptionsSchema,

  // Policies.
  policiesSchema,
  policySchema,

  // Hooks.
  hooksSchema,
  hookSchema,

  // Middlewares.
  middlewaresSchema,
  middlewareSchema,

  // Endpoints.
  endpointSchema
]
