import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiAuthService } from '../services/open-api-auth.service'
import { AppManifest, EntityManifest } from '@mnfst/types'
import { SecuritySchemeObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

describe('OpenApiAuthService', () => {
  let service: OpenApiAuthService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiAuthService]
    }).compile()

    service = module.get<OpenApiAuthService>(OpenApiAuthService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should generate a security scheme for admin auth', () => {
    const appManifestWithoutEntities: AppManifest = {
      entities: {}
    } as AppManifest

    const securitySchemes: Record<string, SecuritySchemeObject> =
      service.getSecuritySchemes(appManifestWithoutEntities)

    expect(Object.keys(securitySchemes)).toHaveLength(1)
    expect(securitySchemes).toHaveProperty('Admin')
  })

  it('should generate a security scheme if entity is authenticable', () => {
    const appManifestWithAuthenticableEntity: AppManifest = {
      name: 'Test',
      entities: {
        user: {
          className: 'User',
          authenticable: true
        } as EntityManifest
      }
    }

    const securitySchemes: Record<string, SecuritySchemeObject> =
      service.getSecuritySchemes(appManifestWithAuthenticableEntity)

    expect(Object.keys(securitySchemes)).toHaveLength(2)
    expect(securitySchemes).toHaveProperty('User')
  })

  it('should not generate a security scheme if entity is not authenticable', () => {
    const appManifestWithNonAuthenticableEntity: AppManifest = {
      name: 'Test',
      entities: {
        user: {
          className: 'User'
        } as EntityManifest
      }
    }

    const securitySchemes: Record<string, SecuritySchemeObject> =
      service.getSecuritySchemes(appManifestWithNonAuthenticableEntity)

    expect(Object.keys(securitySchemes)).toHaveLength(1)
  })

  it('should generate auth paths for admins', () => {
    const appManifestWithoutEntities: AppManifest = {
      entities: {}
    } as AppManifest

    const paths = service.generateAuthPaths(appManifestWithoutEntities)

    expect(paths).toHaveProperty(
      `/api/auth/${ADMIN_ENTITY_MANIFEST.slug}/login`
    )
    expect(paths).toHaveProperty(`/api/auth/${ADMIN_ENTITY_MANIFEST.slug}/me`)
  })

  it('should generate auth paths for authenticable entities', () => {
    const appManifestWithAuthenticableEntity: AppManifest = {
      name: 'Test',
      entities: {
        user: {
          slug: 'users',
          className: 'User',
          authenticable: true,
          policies: {
            create: [{ access: 'public' }],
            read: [{ access: 'public' }],
            update: [{ access: 'public' }],
            delete: [{ access: 'public' }],
            signup: [{ access: 'public' }]
          }
        } as EntityManifest
      }
    }

    const paths = service.generateAuthPaths(appManifestWithAuthenticableEntity)

    expect(paths).toHaveProperty(
      `/api/auth/${appManifestWithAuthenticableEntity.entities.user.slug}/login`
    )
    expect(paths).toHaveProperty(
      `/api/auth/${appManifestWithAuthenticableEntity.entities.user.slug}/signup`
    )
    expect(paths).toHaveProperty(
      `/api/auth/${appManifestWithAuthenticableEntity.entities.user.slug}/me`
    )
  })

  it('should not generate signup path if signup policy is forbidden', () => {
    const appManifestWithForbiddenSignup: AppManifest = {
      name: 'Test',
      entities: {
        user: {
          slug: 'users',
          className: 'User',
          authenticable: true,
          policies: {
            signup: [{ access: 'forbidden' }]
          }
        } as EntityManifest
      }
    }

    const paths = service.generateAuthPaths(appManifestWithForbiddenSignup)

    expect(paths).not.toHaveProperty(
      `/api/auth/${appManifestWithForbiddenSignup.entities.user.slug}/signup`
    )
    expect(paths).not.toHaveProperty(
      `/api/auth/${ADMIN_ENTITY_MANIFEST.slug}/signup`
    )
  })
})
