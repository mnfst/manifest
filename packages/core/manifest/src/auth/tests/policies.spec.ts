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
})
