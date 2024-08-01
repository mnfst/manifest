import { SetMetadata } from '@nestjs/common'
import { Rule as RuleType } from '../types/rule.type'

export const Rule = (rule: RuleType) => SetMetadata('rule', rule)
