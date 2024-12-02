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

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        token: expect.any(String)
      })
    })

    it('can get my current user as admin', async () => {
      const loginResponse: Response = await global.request
        .post('/auth/admins/login')
        .send(DEFAULT_ADMIN_CREDENTIALS)

      const response = await global.request
        .get('/auth/admins/me')
        .set('Authorization', 'Bearer ' + loginResponse.body['token'])

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

    it('returns true if the default user admin is in the database', async () => {
      const response = await global.request.get('/auth/admins/default-exists')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        exists: true
      })
    })
  })

  describe('Authenticable entity', () => {
    it('can signup as an authenticable entity', async () => {
      const response = await global.request
        .post('/auth/users/signup')
        .send(newUserData)

      expect(response.status).toBe(201)
    })

    it('can login as authenticable entity', async () => {
      const errorResponse = await global.request
        .post('/auth/users/login')
        .send({
          email: DEFAULT_ADMIN_CREDENTIALS.email,
          password: 'wrong-password'
        })

      expect(errorResponse.status).toBe(401)

      const loginResponse: Response = await global.request
        .post('/auth/users/login')
        .send(newUserData)

      expect(loginResponse.status).toBe(201)
    })

    it('can get my current user as authenticable entity', async () => {
      const loginResponse: Response = await global.request
        .post('/auth/users/login')
        .send(newUserData)

      const response = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + loginResponse.body['token'])

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        email: newUserData.email
      })
    })

    it('can signup as an authenticable entity', async () => {
      const response = await global.request.post('/auth/users/signup').send({
        email: 'test@example.com',
        password: 'testPassword'
      })

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        token: expect.any(String)
      })
    })
  })

  describe('Non-authenticable entity', () => {
    it('cannot login as non-authenticable entity', async () => {
      const response = await global.request
        .post('/auth/dogs/login')
        .send(newUserData)

      expect(response.status).toBe(400)
    })

    it('cannot signup as non-authenticable entity', async () => {
      const response = await global.request
        .post('/auth/dogs/signup')
        .send(newUserData)

      expect(response.status).toBe(403)
    })
  })
})
