import { Test, TestingModule } from '@nestjs/testing'
import { PolicyService } from '../policy.service'
import { PolicySchema } from '../../../../types/src'
import { PUBLIC_ACCESS_POLICY } from '../../constants'

describe('PolicyService', () => {
  let service: PolicyService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile()

    service = module.get<PolicyService>(PolicyService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should transform policy schemas into policy manifests', () => {
    // Arrange
    const policySchemas: PolicySchema[] = [
      {
        access: '🌐',
        allow: ['User']
      },
      {
        access: '🔒',
        allow: 'Contractor'
      },
      {
        access: '️👨🏻‍💻'
      },
      {
        access: '🚫'
      }
    ]

    const result = service.transformPolicies(
      policySchemas,
      PUBLIC_ACCESS_POLICY
    )

    expect(result).toEqual([
      {
        access: 'public',
        allow: ['User']
      },
      {
        access: 'restricted',
        allow: ['Contractor']
      },
      {
        access: 'admin'
      },
      {
        access: 'forbidden'
      }
    ])
  })

  it('should return default policy if no policies are provided', () => {
    // Arrange
    const result = service.transformPolicies([], PUBLIC_ACCESS_POLICY)

    expect(result).toEqual([PUBLIC_ACCESS_POLICY])
  })

  it('should set the condition if provided', () => {
    // Arrange
    const policySchemas: PolicySchema[] = [
      {
        access: '🌐',
        allow: ['User'],
        condition: 'self'
      }
    ]
    const result = service.transformPolicies(
      policySchemas,
      PUBLIC_ACCESS_POLICY
    )
    expect(result).toEqual([
      {
        access: 'public',
        allow: ['User'],
        condition: 'self'
      }
    ])
  })
})
