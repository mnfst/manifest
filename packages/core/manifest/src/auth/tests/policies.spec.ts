import { ADMIN_ENTITY_MANIFEST } from '../../constants'
import { policies } from '../../policy/policies'

describe('Policies', () => {
  const user = { email: 'admin@testfr' } as any

  describe('admin', () => {
    it('should return true if the user is an admin', () => {
      expect(
        policies.admin(user, { slug: ADMIN_ENTITY_MANIFEST.slug } as any)
      ).toBe(true)
    })

    it('should return false if the user is not an admin', () => {
      const user = { email: 'user@testfr' } as any

      expect(policies.admin(user, { slug: 'contributors' } as any)).toBe(false)
    })
  })

  describe('public', () => {
    it('should return true', () => {
      expect(policies.public(user, {} as any)).toBe(true)
    })
  })

  describe('forbidden', () => {
    it('should return false', () => {
      expect(policies.forbidden(user, {} as any)).toBe(false)
    })
  })

  describe('restricted', () => {
    it('should return true if the user is an admin', () => {
      expect(
        policies.restricted(user, { slug: ADMIN_ENTITY_MANIFEST.slug } as any, {
          allow: ['users']
        })
      ).toBe(true)
    })

    it('should return false if there is no user logged in', () => {
      expect(
        policies.restricted(null, { slug: 'contributors' } as any, {
          allow: []
        })
      ).toBe(false)
    })

    it('should return true if the user is logged in and from entity list', () => {
      expect(
        policies.restricted(user, { className: 'contributors' } as any, {
          allow: ['contributors', 'guests']
        })
      ).toBe(true)
    })

    it('should return false if the user is logged in but not in list', () => {
      expect(
        policies.restricted(user, { className: 'guests' } as any, {
          allow: ['users']
        })
      ).toBe(false)
    })
  })
})
