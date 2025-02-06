import { Test } from '@nestjs/testing'
import { PolicyGuard } from '../policy.guard'
import { Reflector } from '@nestjs/core'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { AuthService } from '../../auth/auth.service'
import { EntityManifest } from '@repo/types'

describe('PolicyGuard', () => {
  let authorizationGuard: PolicyGuard
  let reflector: Reflector
  let entityManifestService: EntityManifestService

  const context: any = {
    getHandler: jest.fn(() => 'handler'),
    getArgs: jest.fn(() => [
      {
        params: {
          entity: 'entity'
        }
      }
    ]),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => ({
        user: {},
        entitySlug: 'entitySlug'
      }))
    }))
  }

  const endpointContext: any = {
    getHandler: jest.fn(() => 'handler'),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => ({
        endpoint: {
          policies: [{ access: 'public' }]
        }
      }))
    }))
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PolicyGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn()
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        },
        {
          provide: AuthService,
          useValue: {
            getUserFromRequest: jest.fn()
          }
        }
      ]
    }).compile()

    authorizationGuard = module.get<PolicyGuard>(PolicyGuard)
    reflector = module.get<Reflector>(Reflector)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  it('should be defined', () => {
    expect(authorizationGuard).toBeDefined()
  })

  it('should return true if rule is not defined', async () => {
    const result = await authorizationGuard.canActivate(context)

    expect(result).toBe(true)
  })

  describe('Policies on CRUD operations', () => {
    it('should return true if rule is defined and all policies pass', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue('read')
      jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
        policies: {
          read: [{ access: 'public' }]
        }
      } as EntityManifest)

      const result = await authorizationGuard.canActivate(context)

      expect(result).toBe(true)
    })

    it('should return false if rule is defined and at least one policy fails', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue('delete')
      jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
        policies: {
          delete: [{ access: 'public' }, { access: 'forbidden' }]
        }
      } as EntityManifest)

      const result = await authorizationGuard.canActivate(context)

      expect(result).toBe(false)
    })
  })

  describe('Policies on dynamic endpoints', () => {
    it('should return true if no policies', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue('dynamic-endpoint')
      const result = await authorizationGuard.canActivate(context)

      expect(result).toBe(true)
    })

    it('should return true if all policies pass', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue('dynamic-endpoint')

      const result = await authorizationGuard.canActivate(endpointContext)

      expect(result).toBe(true)
    })

    it('should return false if at least one policy fails', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue('dynamic-endpoint')

      const failingEndpointContext = {
        getHandler: jest.fn(() => 'handler'),
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            endpoint: {
              policies: [{ access: 'forbidden' }]
            }
          }))
        }))
      } as any

      const result = await authorizationGuard.canActivate(
        failingEndpointContext
      )

      expect(result).toBe(false)
    })
  })
})
