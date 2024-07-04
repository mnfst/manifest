import { DEFAULT_ADMIN_CREDENTIALS } from '../../src/constants'

const newUserData = {
  email: 'newUser@example.com',
  password: 'password'
}

describe('Authentication (e2e)', () => {
  describe('Admin', () => {
    it('can login as admin', async () => {
      const errorResponse = await global.request
        .post('/auth/admins/login')
        .send({
          email: DEFAULT_ADMIN_CREDENTIALS.email,
          password: 'wrong-password'
        })

      expect(errorResponse.status).toBe(401)

      const response = await global.request
        .post('/auth/admins/login')
        .send(DEFAULT_ADMIN_CREDENTIALS)

      expect(response.status).toBe(200)
    })

    it('can get my current user as admin', async () => {
      const response = await global.request.get('/auth/admins/me')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        email: DEFAULT_ADMIN_CREDENTIALS.email
      })
    })

    it('cannot signup as an admin', async () => {
      const response = await global.request.post('/auth/admins/signup').send({
        email: 'test@example.com',
        password: 'testPassword'
      })

      expect(response.status).toBe(403)
    })
  })

  describe('Authenticable entity', () => {
    it('can login as authenticable entity', async () => {
      const errorResponse = await global.request
        .post('/auth/users/login')
        .send({
          email: DEFAULT_ADMIN_CREDENTIALS.email,
          password: 'wrong-password'
        })

      expect(errorResponse.status).toBe(401)

      const response = await global.request
        .post('/auth/users/login')
        .send(newUserData)

      expect(response.status).toBe(200)
    })

    it('can get my current user as authenticable entity', async () => {
      const response = await global.request.get('/auth/users/me')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        email: newUserData.email
      })
    })

    it('can signup if signup rule is public', async () => {
      const response = await global.request
        .post('/auth/users/signup')
        .send(newUserData)

      expect(response.status).toBe(201)
    })

    it('cannot signup if signup rule is not public', async () => {
      const response = await global.request
        .post('/auth/contributors/signup')
        .send(newUserData)

      expect(response.status).toBe(403)
    })
  })

  describe('Other entity', () => {
    it('cannot login as other entity', async () => {
      const response = await global.request
        .post('/auth/dogs/login')
        .send(newUserData)

      expect(response.status).toBe(404)
    })

    it('cannot signup as other entity', async () => {
      const response = await global.request
        .post('/auth/dogs/signup')
        .send(newUserData)

      expect(response.status).toBe(404)
    })
  })
})
