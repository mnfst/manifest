import entitySchema from './schema/definitions/entity-schema.json'
import propertyOptionsSchema from './schema/definitions/property-options-schema.json'
import choiceOptionsSchema from './schema/definitions/property-options/choice-options-schema.json'
import moneyOptionsSchema from './schema/definitions/property-options/money-options-schema.json'
import propertySchema from './schema/definitions/property-schema.json'
import relationshipSchema from './schema/definitions/relationship-schema.json'
import validationSchema from './schema/definitions/validation-schema.json'
import manifestSchema from './schema/schema.json'
import policiesSchema from './schema/definitions/policies/policies-schema.json'
import policySchema from './schema/definitions/policies/policy-schema.json'

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

  // TODO: fileOptionsSchema, imageOptionsSchema

  // Policies.
  policiesSchema,
  policySchema
]
