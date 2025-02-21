import { DEFAULT_ADMIN_CREDENTIALS } from '../../src/constants'

describe('Authorization (e2e)', () => {
  const newUserData = {
    email: 'newUser@example.com',
    password: 'password'
  }

  let adminToken: string
  let userToken: string
  let contributorToken: string

  beforeAll(async () => {
    // Get admin token (login as default admin).
    const adminLoginResponse = await global.request
      .post('/auth/admins/login')
      .send(DEFAULT_ADMIN_CREDENTIALS)
    adminToken = adminLoginResponse.body.token

    // Get user token (signup as new user and get token).
    const userSignupResponse = await global.request
      .post('/auth/users/signup')
      .send(newUserData)
    userToken = userSignupResponse.body.token

    // Get contributor token (signup as new contributor and get token).
    const contributorSignupResponse = await global.request
      .post('/auth/contributors/signup')
      .send(newUserData)
    contributorToken = contributorSignupResponse.body.token
  })

  describe('Rules', () => {
    it('should have public access by default', async () => {
      const listResponse = await global.request.get('/collections/owners')

      expect(listResponse.status).toBe(200)
    })

    it('should allow access to public rules to everyone', async () => {
      const listResponse = await global.request.get('/collections/cats')
      const showResponse = await global.request.get('/collections/cats/1')

      expect(listResponse.status).toBe(200)
      expect(showResponse.status).toBe(200)
    })

    it('should allow access to restricted rules to all logged in users if no entity is provided', async () => {
      const restrictedCreateResponseAsUser = await global.request
        .post('/collections/birds')
        .send({
          name: 'lala'
        })
        .set('Authorization', 'Bearer ' + userToken)

      const restrictedCreateResponseAsContributor = await global.request
        .post('/collections/birds')
        .send({
          name: 'lala'
        })
        .set('Authorization', 'Bearer ' + contributorToken)

      expect(restrictedCreateResponseAsUser.status).toBe(201)
      expect(restrictedCreateResponseAsContributor.status).toBe(201)
    })

    it('should allow access to restricted rules to logged in users of a defined entity if provided', async () => {
      const restrictedToUsersUpdateResponse = await global.request
        .put('/collections/birds/1')
        .set('Authorization', 'Bearer ' + userToken)
        .send({ name: 'new name' })

      // Policy where 2
      const restrictedToContributorsAndUsersUpdateResponse =
        await global.request
          .get('/collections/birds/1')
          .set('Authorization', 'Bearer ' + userToken)

      expect(restrictedToUsersUpdateResponse.status).toBe(200)
      expect(restrictedToContributorsAndUsersUpdateResponse.status).toBe(200)
    })

    it('should allow access to admin rules only to admins', async () => {
      const adminReadResponse = await global.request
        .get('/collections/snakes')
        .set('Authorization', 'Bearer ' + adminToken)

      const userReadResponse = await global.request
        .get('/collections/snakes')
        .set('Authorization', 'Bearer ' + userToken)

      const guestReadResponse = await global.request.get('/collections/snakes')

      expect(adminReadResponse.status).toBe(200)
      expect(userReadResponse.status).toBe(403)
      expect(guestReadResponse.status).toBe(403)
    })

    it('should deny access to restricted rules to guests', async () => {
      const restrictedCreateResponse =
        await global.request.post('/collections/birds')

      const restrictedToContributorsAndUsersUpdateResponse =
        await global.request.get('/collections/birds/1')

      expect(restrictedCreateResponse.status).toBe(403)
      expect(restrictedToContributorsAndUsersUpdateResponse.status).toBe(403)
    })

    it('should deny access to restricted rules to users of other entities if entity is provided', async () => {
      const restrictedToUsersUpdateResponse = await global.request
        .put('/collections/birds/1')
        .set('Authorization', 'Bearer ' + contributorToken)
        .send({ name: 'new name' })

      expect(restrictedToUsersUpdateResponse.status).toBe(403)
    })

    it('should deny access to everyone even admins for forbidden rules', async () => {
      const forbiddenUpdateResponseAsGuest = await global.request
        .post('/auth/snakes/signup')
        .send(newUserData)

      const forbiddenUpdateResponseAsUser = await global.request
        .post('/auth/snakes/signup')
        .set('Authorization', 'Bearer ' + userToken)
        .send(newUserData)

      const forbiddenUpdateResponseAsAdmin = await global.request
        .post('/auth/snakes/signup')
        .set('Authorization', 'Bearer ' + adminToken)
        .send(newUserData)

      expect(forbiddenUpdateResponseAsGuest.status).toBe(403)
      expect(forbiddenUpdateResponseAsUser.status).toBe(403)
      expect(forbiddenUpdateResponseAsAdmin.status).toBe(403)
    })

    it('should work with multiple rules creating and AND logic between rules', async () => {
      const restrictedTwiceDeleteResponseAsUser = await global.request
        .delete('/collections/birds/1')
        .set('Authorization', 'Bearer ' + userToken)

      const restrictedTwiceDeleteResponseAsContributor = await global.request
        .delete('/collections/birds/1')
        .set('Authorization', 'Bearer ' + contributorToken)

      expect(restrictedTwiceDeleteResponseAsUser.status).toBe(403)
      expect(restrictedTwiceDeleteResponseAsContributor.status).toBe(403)
    })

    it('should work with emojis shortcodes', async () => {
      const publicResponseUsingEmoji =
        await global.request.get('/collections/cats')
      const restrictedResponseUsingEmoji = await global.request
        .post('/collections/cats')
        .send({
          name: 'new cat',
          hiddenProp: true
        })
      const forbiddenResponseUsingEmoji = await global.request
        .delete('/collections/cats/1')
        .set('Authorization', 'Bearer ' + adminToken)

      expect(publicResponseUsingEmoji.status).toBe(200)
      expect(restrictedResponseUsingEmoji.status).toBe(403)
      expect(forbiddenResponseUsingEmoji.status).toBe(403)
    })
  })

  describe('Admin role', () => {
    it('admins are only visible to other admins', async () => {
      const adminReadResponseAsAdmin = await global.request
        .get('/collections/admins')
        .set('Authorization', 'Bearer ' + adminToken)

      const userReadResponseAsAdmin = await global.request
        .get('/collections/admins')
        .set('Authorization', 'Bearer ' + userToken)

      const guestReadResponseAsAdmin = await global.request.get(
        '/collections/admins'
      )

      expect(adminReadResponseAsAdmin.status).toBe(200)
      expect(userReadResponseAsAdmin.status).toBe(403)
      expect(guestReadResponseAsAdmin.status).toBe(403)
    })

    it('only admins can manage admins', async () => {
      const newAdmin = {
        email: 'new@email.com',
        password: 'password'
      }

      const adminCreateAdminResponse = await global.request
        .post('/collections/admins')
        .send(newAdmin)
        .set('Authorization', 'Bearer ' + adminToken)

      const userCreateAdminResponse = await global.request
        .post('/collections/admins')
        .send(newAdmin)
        .set('Authorization', 'Bearer ' + userToken)

      const guestCreateAdminResponse = await global.request
        .post('/collections/admins')
        .send(newAdmin)

      expect(adminCreateAdminResponse.status).toBe(201)
      expect(userCreateAdminResponse.status).toBe(403)
      expect(guestCreateAdminResponse.status).toBe(403)
    })

    it('hidden properties of entities are only visible to admins', async () => {
      const responseAsAdmin = await global.request
        .get('/collections/cats/1')
        .set('Authorization', 'Bearer ' + adminToken)

      const responseAsUser = await global.request
        .get('/collections/cats/1')
        .set('Authorization', 'Bearer ' + userToken)

      const responseAsGuest = await global.request.get('/collections/cats/1')

      expect(responseAsAdmin.body.name).toBeDefined()
      expect(responseAsUser.body.name).toBeDefined()
      expect(responseAsGuest.body.name).toBeDefined()

      expect(responseAsAdmin.body.hiddenProp).toBeDefined()
      expect(responseAsUser.body.hiddenProp).not.toBeDefined()
      expect(responseAsGuest.body.hiddenProp).not.toBeDefined()
    })
  })
})
