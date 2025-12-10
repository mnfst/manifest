import { ADMIN_ENTITY_MANIFEST } from '../../constants'
import { policies } from '../../policy/policies'

describe('Policies', () => {
  const user = { email: 'admin@manifest.build' } as any

  describe('admin', () => {
    it('should return true if the user is an admin', async () => {
      expect(
        await policies.admin({
          user,
          userEntityManifest: { slug: ADMIN_ENTITY_MANIFEST.slug }
        } as any)
      ).toBe(true)
    })

    it('should return false if the user is not an admin', async () => {
      const user = { email: 'user@testfr' } as any

      expect(
        await policies.admin({
          user,
          userEntityManifest: { slug: 'contributors' }
        } as any)
      ).toBe(false)
    })
  })

  describe('public', () => {
    it('should return true', async () => {
      expect(await policies.public({ user } as any)).toBe(true)
    })
  })

  describe('forbidden', () => {
    it('should return false', async () => {
      expect(await policies.forbidden({ user } as any)).toBe(false)
    })
  })

  describe('restricted', () => {
    it('should return true if the user is an admin', async () => {
      expect(
        await policies.restricted({
          user,
          userEntityManifest: { slug: ADMIN_ENTITY_MANIFEST.slug },
          allow: ['users']
        } as any)
      ).toBe(true)
    })

    it('should return false if there is no user logged in', async () => {
      expect(
        await policies.restricted({
          user: null,
          userEntityManifest: { slug: 'contributors' },
          allow: []
        } as any)
      ).toBe(false)
    })

    it('should return true if the user is logged in and from entity list', async () => {
      expect(
        await policies.restricted({
          user,
          userEntityManifest: {
            slug: 'contributors',
            className: 'Contributor'
          },
          allow: ['Contributor', 'Guest']
        } as any)
      ).toBe(true)
    })

    it('should return false if the user is logged in but not in list', async () => {
      expect(
        await policies.restricted({
          user,
          userEntityManifest: { slug: 'contributors' },
          options: { allow: ['User'] }
        } as any)
      ).toBe(false)
    })
  })

  describe('restricted (self)', () => {
    it('should return true if the user is creating a new record for himself or herself', async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const request = {
        body: { ownerId: '123' } // Assuming 'owner' is the field for ownership
      }
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any
      const result = await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        rule: 'create',
        options: { condition: 'self' }
      } as any)
      expect(result).toBe(true)
    })

    it('should return false if the user is creating a new record for another user', async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const request = {
        body: { owner: '456' } // Assuming 'owner' is the field for ownership
      }
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any
      const result = await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        rule: 'create',
        options: { condition: 'self' }
      } as any)

      expect(result).toBe(false)
    })

    it('should return false if the user is updating a record that is not his or hers', async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const request = {
        params: {
          id: '1' // ID of the record being updated
        },
        body: {
          name: 'Updated Name'
        }
      } as any
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any
      const result = await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        entityRepository: {
          findOneOrFail: async () => ({
            id: '1',
            owner: { id: '789' } // Owner of the record is not the user
          })
        } as any,
        rule: 'update',
        options: { condition: 'self' }
      })

      expect(result).toBe(false)
    })

    it('should return true if the user is updating a record that is his or hers', async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const request = {
        params: {
          id: '1' // ID of the record being updated
        },
        body: {
          name: 'Updated Name'
        }
      } as any
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any
      const result = await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        entityRepository: {
          findOneOrFail: async () => ({
            id: '1',
            owner: { id: '123' } // Owner of the record is the user
          })
        } as any,
        rule: 'update',
        options: { condition: 'self' }
      })

      expect(result).toBe(true)
    })

    it('should return false if the user is changing the ownership of a record to another user', async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const request = {
        params: {
          id: '1' // ID of the record being updated
        },
        body: {
          name: 'Updated Name',
          ownerId: '456' // Changing ownership to another user
        }
      } as any
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any
      const result = await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        entityRepository: {
          findOneOrFail: async () => ({
            id: '1',
            owner: { id: '123' } // Owner of the record is the user
          })
        } as any,
        rule: 'update',
        options: { condition: 'self' }
      })

      expect(result).toBe(false)
    })

    it('should return false if the user is deleting a record that is not his or hers', async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const request = {
        params: {
          id: '1' // ID of the record being deleted
        }
      } as any
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any
      const result = await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        entityRepository: {
          findOneOrFail: async () => ({
            id: '1',
            owner: { id: '789' } // Owner of the record is not the user
          })
        } as any,
        rule: 'delete',
        options: { condition: 'self' }
      })
      expect(result).toBe(false)
    })

    it('should return true if the user is deleting a record that is his or hers', async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const request = {
        params: {
          id: '1' // ID of the record being deleted
        }
      } as any
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any
      const result = await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        entityRepository: {
          findOneOrFail: async () => ({
            id: '1',
            owner: { id: '123' } // Owner of the record is the user
          })
        } as any,
        rule: 'delete',
        options: { condition: 'self' }
      })
      expect(result).toBe(true)
    })

    it("should only list owner's records when fetching a list", async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any

      const request = {
        query: {}
      } as any

      await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        rule: 'read',
        options: { condition: 'self' }
      })

      expect(request.query).toEqual({
        'owner.id_eq': '123', // Only owner's records should be fetched
        relations: 'owner' // Ensure the owner relation is included
      })
    })

    it('should restrict single record access based on ownership', async () => {
      const user = { id: '123', email: 'test@test.com' } as any
      const userEntityManifest = { className: 'User', slug: 'users' } as any
      const entityManifest = {
        relationships: [
          {
            name: 'owner',
            entity: 'User',
            propertyName: 'owner',
            type: 'many-to-one'
          }
        ]
      } as any
      const request = {
        params: {
          id: '1' // ID of the record being accessed
        },
        query: {}
      } as any

      await policies.restricted({
        user,
        userEntityManifest,
        request,
        entityManifest,
        rule: 'read',
        options: { condition: 'self' }
      })

      expect(request.query).toEqual({
        'owner.id_eq': '123', // Only owner's record should be fetched
        relations: 'owner' // Ensure the owner relation is included
      })
    })
  })
})
