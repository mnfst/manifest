import { SetMetadata } from '@nestjs/common'
import { RestrictionRule } from '../../../shared/types/restriction-rule.type'

export const EndpointRestrictionRule = (restrictionRule: RestrictionRule) =>
  SetMetadata('restrictionRule', restrictionRule)
