import { SetMetadata } from '@nestjs/common'
import { Rule as RuleType } from '../../../../types/src/policies/Rule'

export const Rule = (rule: RuleType) => SetMetadata('rule', rule)
