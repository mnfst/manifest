import { OpenAPIObject } from '@nestjs/swagger'
import * as fs from 'fs'
import { load } from 'js-yaml'

describe('OpenAPI (e2e)', () => {
  let openApiObject: OpenAPIObject

  beforeAll(() => {
    openApiObject = load(
      fs.readFileSync(
        `${process.cwd()}/e2e/manifest/.manifest/openapi.yml`,
        'utf8'
      )
    ) as OpenAPIObject

    console.log(openApiObject.paths['/collections/dogs'])
  })

  describe('Swagger UI', () => {
    it('Should generate an UI', async () => {
      const response = await global.request.get('/api')

      expect(response.status).toBe(200)
      expect(response.text).toContain('<html lang="en">')
    })
  })

  describe('OpenAPI file', () => {
    it('Should generate an OpenAPI file', async () => {
      expect(openApiObject).toBeDefined()
      expect(openApiObject.openapi).toBeDefined()
      expect(openApiObject.info).toBeDefined()
      expect(openApiObject.components).toBeDefined()
    })

    it('should include server information', async () => {
      expect(openApiObject.servers).toBeDefined()
      expect(openApiObject.servers.length).toBe(1)
      expect(openApiObject.servers[0].url).toBe('http://localhost:1111/api')
      expect(openApiObject.servers[0].description).toBe('Development server')
    })

    it('should include CRUD paths for public endpoints', async () => {
      // Public rules.
      expect(openApiObject.paths).toBeDefined()
      expect(openApiObject.paths['/collections/dogs']).toBeDefined()
      expect(openApiObject.paths['/collections/dogs'].get).toBeDefined()
      expect(openApiObject.paths['/collections/dogs'].post).toBeDefined()
      expect(openApiObject.paths['/collections/dogs/{id}']).toBeDefined()
      expect(openApiObject.paths['/collections/dogs/{id}'].get).toBeDefined()
      expect(openApiObject.paths['/collections/dogs/{id}'].put).toBeDefined()
      expect(openApiObject.paths['/collections/dogs/{id}'].patch).toBeDefined()
      expect(openApiObject.paths['/collections/dogs/{id}'].delete).toBeDefined()
    })

    it('should not include CRUD paths for forbidden endpoints', async () => {
      // Forbidden rules do not appear on OpenAPI.
      expect(openApiObject.paths['/collections/cats/{id}'].put).toBeUndefined()
      expect(
        openApiObject.paths['/collections/cats/{id}'].patch
      ).toBeUndefined()
      expect(
        openApiObject.paths['/collections/cats/{id}'].delete
      ).toBeUndefined()
    })

    it('should include CRUD paths for authenticated endpoints', async () => {
      // Authenticated rules.

      expect(openApiObject.paths['/collections/cats'].post).toBeDefined()
      expect(
        openApiObject.paths['/collections/cats'].post.security.length
      ).toBeGreaterThan(0)
    })

    it('should generate auth paths for admins and authenticable entities', async () => {
      // Login paths.
      expect(openApiObject.paths['/auth/snakes/login']?.post).toBeDefined()
      expect(openApiObject.paths['/auth/users/login']?.post).toBeDefined()
      expect(
        openApiObject.paths['/auth/contributors/login']?.post
      ).toBeDefined()
      expect(openApiObject.paths['/auth/super-users/login']?.post).toBeDefined()
      expect(openApiObject.paths['/auth/super-users/login']?.post).toBeDefined()

      // Signup paths.
      expect(openApiObject.paths['/auth/snakes/signup']?.post).toBeUndefined() // Signup forbidden policy.
      expect(openApiObject.paths['/auth/users/signup']?.post).toBeDefined()
      expect(
        openApiObject.paths['/auth/contributors/signup']?.post
      ).toBeDefined()
      expect(
        openApiObject.paths['/auth/super-users/signup']?.post
      ).toBeDefined()

      // "/me" paths.
      expect(openApiObject.paths['/auth/snakes/me']?.get).toBeDefined()
      expect(openApiObject.paths['/auth/users/me']?.get).toBeDefined()
      expect(openApiObject.paths['/auth/contributors/me']?.get).toBeDefined()
      expect(openApiObject.paths['/auth/super-users/me']?.get).toBeDefined()
    })

    it('should generate endpoint paths', async () => {
      expect(openApiObject.paths['/endpoints/basic']?.get).toBeDefined()
      expect(openApiObject.paths['/endpoints/create-dog']?.post).toBeDefined()
    })

    it('should generate schemas for entities', async () => {
      expect(openApiObject.components.schemas.User).toBeDefined()
      expect(openApiObject.components.schemas.Bird).toBeDefined()
      expect(openApiObject.components.schemas.Cat).toBeDefined()
      expect(openApiObject.components.schemas.Snake).toBeDefined()
      expect(openApiObject.components.schemas.Dog).toBeDefined()
      expect(openApiObject.components.schemas.Contributor).toBeDefined()
      expect(openApiObject.components.schemas.SuperUser).toBeDefined()
    })

    it('should generate DTO schemas for entities', async () => {
      expect(openApiObject.components.schemas.CreateUpdateUserDto).toBeDefined()
      expect(openApiObject.components.schemas.CreateUpdateBirdDto).toBeDefined()
      expect(openApiObject.components.schemas.CreateUpdateCatDto).toBeDefined()
      expect(
        openApiObject.components.schemas.CreateUpdateSnakeDto
      ).toBeDefined()
      expect(openApiObject.components.schemas.CreateUpdateDogDto).toBeDefined()
      expect(
        openApiObject.components.schemas.CreateUpdateContributorDto
      ).toBeDefined()
      expect(
        openApiObject.components.schemas.CreateUpdateSuperUserDto
      ).toBeDefined()
    })

    it('should generate general schemas', async () => {
      expect(openApiObject.components.schemas.Paginator).toBeDefined()
      expect(openApiObject.components.schemas.SelectOption).toBeDefined()
      expect(openApiObject.components.schemas.AppManifest).toBeDefined()
      expect(openApiObject.components.schemas.EntityManifest).toBeDefined()
      expect(
        openApiObject.components.schemas.RelationshipManifest
      ).toBeDefined()
      expect(openApiObject.components.schemas.PropertyManifest).toBeDefined()
    })
  })
})
