import { Test } from '@nestjs/testing'
import { AuthorizationGuard } from '../guards/authorization.guard'
import { Reflector } from '@nestjs/core'
import { ManifestService } from '../../manifest/services/manifest.service'
import { AuthService } from '../auth.service'
import { EntityManifest } from '@repo/types'

describe('AuthorizationGuard', () => {
  let authorizationGuard: AuthorizationGuard
  let reflector: Reflector
  let manifestService: ManifestService

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

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthorizationGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn()
          }
        },
        {
          provide: ManifestService,
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

    authorizationGuard = module.get<AuthorizationGuard>(AuthorizationGuard)
    reflector = module.get<Reflector>(Reflector)
    manifestService = module.get<ManifestService>(ManifestService)
  })

  it('should be defined', () => {
    expect(authorizationGuard).toBeDefined()
  })

  it('should return true if rule is not defined', async () => {
    const result = await authorizationGuard.canActivate(context)

    expect(result).toBe(true)
  })

  it('should return true if rule is defined and all policies pass', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue('read')
    jest.spyOn(manifestService, 'getEntityManifest').mockReturnValue({
      policies: {
        read: [{ access: 'public' }]
      }
    } as EntityManifest)

    const result = await authorizationGuard.canActivate(context)

    expect(result).toBe(true)
  })

  it('should return false if rule is defined and at least one policy fails', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue('read')
    jest.spyOn(manifestService, 'getEntityManifest').mockReturnValue({
      policies: {
        read: [{ access: 'public' }, { access: 'forbidden' }]
      }
    } as EntityManifest)

    const result = await authorizationGuard.canActivate(context)

    expect(result).toBe(false)
  })
})
