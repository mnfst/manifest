import entitySchema from './definitions/entity-schema.json'
import propertyOptionsSchema from './definitions/property-options-schema.json'
import choiceOptionsSchema from './definitions/property-options/choice-options-schema.json'
import moneyOptionsSchema from './definitions/property-options/money-options-schema.json'
import propertySchema from './definitions/property-schema.json'
import relationshipSchema from './definitions/relationship-schema.json'
import manifestSchema from './schema.json'

export default [
  manifestSchema,
  entitySchema,
  propertySchema,
  relationshipSchema,
  propertyOptionsSchema,
  choiceOptionsSchema,
  moneyOptionsSchema
]
