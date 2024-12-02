import { Test } from '@nestjs/testing'
import { IsAdminGuard } from '../guards/is-admin.guard'
import { AuthService } from '../auth.service'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'
import { AuthenticableEntity } from '@repo/types'
import { ExecutionContext } from '@nestjs/common'

describe('IsAdminGuard', () => {
  let authService: AuthService

  const context = {
    switchToHttp: () => ({
      getRequest: () => {}
    })
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IsAdminGuard,
        {
          provide: AuthService,
          useValue: {
            getUserFromRequest: jest.fn()
          }
        }
      ]
    }).compile()

    authService = module.get<AuthService>(AuthService)
  })

  it('should be defined', () => {
    expect(new IsAdminGuard(authService)).toBeDefined()
  })

  it('should return true is user is admin', async () => {
    jest.spyOn(authService, 'getUserFromRequest').mockReturnValue(
      Promise.resolve({
        user: {} as AuthenticableEntity,
        entitySlug: ADMIN_ENTITY_MANIFEST.slug
      })
    )

    const isAdminGuard = new IsAdminGuard(authService)
    const res = await isAdminGuard.canActivate(context as ExecutionContext)

    expect(res).toBe(true)
  })

  it('should return false is user is not admin', async () => {
    jest.spyOn(authService, 'getUserFromRequest').mockReturnValue(
      Promise.resolve({
        user: {} as AuthenticableEntity,
        entitySlug: 'not-admin'
      })
    )

    const isAdminGuard = new IsAdminGuard(authService)
    const res = await isAdminGuard.canActivate(context as ExecutionContext)

    expect(res).toBe(false)
  })
})
