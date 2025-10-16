import { DEFAULT_ADMIN_CREDENTIALS } from '../../src/constants'

describe('Authorization (e2e)', () => {
  const newUserData = {
    email: 'newUser@example.com',
    password: 'password'
  }

  let adminToken: string
  let userToken: string
  let contributorToken: string

  let ownerId: string
  let catId: string
  let birdId: string

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

    // Create a new owner and an new cat (to test rules).
    ownerId = (
      await global.request
        .post('/collections/owners')
        .send({
          name: 'new owner'
        })
        .set('Authorization', 'Bearer ' + adminToken)
    ).body.id

    catId = (
      await global.request
        .post('/collections/cats')
        .send({
          name: 'new cat'
        })
        .set('Authorization', 'Bearer ' + adminToken)
    ).body.id

    birdId = (
      await global.request
        .post('/collections/birds')
        .send({
          name: 'new bird'
        })
        .set('Authorization', 'Bearer ' + adminToken)
    ).body.id
  })

  describe('General behaviors', () => {
    it('should have admin access by default', async () => {
      const listResponse = await global.request.get('/collections/owners')
      const createResponse = await global.request
        .post('/collections/owners')
        .send({
          name: 'new owner'
        })

      const showResponse = await global.request.get(
        `/collections/owners/${ownerId}`
      )

      const updateResponse = await global.request
        .put(`/collections/owners/${ownerId}`)
        .send({
          name: 'updated owner'
        })
      const deleteResponse = await global.request.delete(
        `/collections/owners/${ownerId}`
      )

      const adminListResponse = await global.request
        .get('/collections/owners')
        .set('Authorization', 'Bearer ' + adminToken)

      const adminCreateResponse = await global.request
        .post('/collections/owners')
        .send({
          name: 'new owner'
        })
        .set('Authorization', 'Bearer ' + adminToken)
      const adminShowResponse = await global.request
        .get(`/collections/owners/${ownerId}`)
        .set('Authorization', 'Bearer ' + adminToken)
      const adminUpdateResponse = await global.request
        .put(`/collections/owners/${ownerId}`)
        .send({
          name: 'updated owner'
        })
        .set('Authorization', 'Bearer ' + adminToken)
      const adminDeleteResponse = await global.request
        .delete(`/collections/owners/${ownerId}`)
        .set('Authorization', 'Bearer ' + adminToken)

      expect(listResponse.status).toBe(403)
      expect(showResponse.status).toBe(403)
      expect(createResponse.status).toBe(403)
      expect(updateResponse.status).toBe(403)
      expect(deleteResponse.status).toBe(403)

      expect(adminListResponse.status).toBe(200)
      expect(adminShowResponse.status).toBe(200)
      expect(adminCreateResponse.status).toBe(201)
      expect(adminUpdateResponse.status).toBe(200)
      expect(adminDeleteResponse.status).toBe(200)
    })

    it('should work with multiple rules creating and AND logic between rules', async () => {
      const restrictedTwiceDeleteResponseAsUser = await global.request
        .delete(`/collections/birds/${birdId}`)
        .set('Authorization', 'Bearer ' + userToken)

      const restrictedTwiceDeleteResponseAsContributor = await global.request
        .delete(`/collections/birds/${birdId}`)
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

  describe('Public rules', () => {
    it('should allow access to public rules to everyone', async () => {
      const listResponse = await global.request.get('/collections/cats')
      const showResponse = await global.request.get(
        `/collections/cats/${catId}`
      )

      expect(listResponse.status).toBe(200)
      expect(showResponse.status).toBe(200)
    })
  })

  describe('Restricted rules', () => {
    it('should allow access to restricted rules to logged in users of a defined entity if provided', async () => {
      const restrictedToUsersUpdateResponse = await global.request
        .put(`/collections/birds/${birdId}`)
        .set('Authorization', 'Bearer ' + userToken)
        .send({ name: 'new name' })

      // Policy where 2
      const restrictedToContributorsAndUsersUpdateResponse =
        await global.request
          .get(`/collections/birds/${birdId}`)
          .set('Authorization', 'Bearer ' + userToken)

      expect(restrictedToUsersUpdateResponse.status).toBe(200)
      expect(restrictedToContributorsAndUsersUpdateResponse.status).toBe(200)
    })

    it('should deny access to restricted rules to guests', async () => {
      const restrictedCreateResponse =
        await global.request.post('/collections/birds')

      const restrictedToContributorsAndUsersUpdateResponse =
        await global.request.get(`/collections/birds/${birdId}`)

      expect(restrictedCreateResponse.status).toBe(403)
      expect(restrictedToContributorsAndUsersUpdateResponse.status).toBe(403)
    })

    it('should deny access to restricted rules to users of other entities if entity is provided', async () => {
      const restrictedToUsersUpdateResponse = await global.request
        .put(`/collections/birds/${birdId}`)
        .set('Authorization', 'Bearer ' + contributorToken)
        .send({ name: 'new name' })

      expect(restrictedToUsersUpdateResponse.status).toBe(403)
    })
  })

  describe('Restricted rules with ownership based access (self)', () => {
    it('should only allow creating a record for owner', async () => {
      // Create 2 users.
      const userASignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'usera@example.com',
          password: 'password'
        })
      const userAToken: string = userASignupResponse.body.token

      const userBSignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'userb@example.com',
          password: 'password'
        })
      const userBToken: string = userBSignupResponse.body.token

      // Get their IDs.
      const userAID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userAToken)
        .then((res) => res.body.id)
      const userBID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userBToken)
        .then((res) => res.body.id)

      expect(userAID).toBeDefined()
      expect(userBID).toBeDefined()
      expect(userAID).not.toEqual(userBID)

      // User A creates a record as owner.
      const userACreateResponse = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User A',
          userId: userAID
        })
        .set('Authorization', 'Bearer ' + userAToken)

      const userACreateResponseForUserBFrog = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User B',
          userId: userBID
        })
        .set('Authorization', 'Bearer ' + userAToken)

      expect(userACreateResponse.status).toBe(201)
      expect(userACreateResponseForUserBFrog.status).toBe(403)
    })

    it("should only show owner's records", async () => {
      // Create 2 users.
      const userASignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'usera2@example.com',
          password: 'password'
        })
      const userAToken: string = userASignupResponse.body.token

      const userBSignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'userb2@example.com',
          password: 'password'
        })
      const userBToken: string = userBSignupResponse.body.token

      // Get their IDs.
      const userAID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userAToken)
        .then((res) => res.body.id)
      const userBID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userBToken)
        .then((res) => res.body.id)

      // Create one record for each user.
      const frogCreateResponseForUserA = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User A',
          userId: userAID
        })
        .set('Authorization', 'Bearer ' + userAToken)

      const frogCreateResponseForUserB = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User B',
          userId: userBID
        })
        .set('Authorization', 'Bearer ' + userBToken)

      expect(frogCreateResponseForUserA.status).toBe(201)
      expect(frogCreateResponseForUserB.status).toBe(201)

      const listResponseAsUserA = await global.request
        .get('/collections/frogs')
        .set('Authorization', 'Bearer ' + userAToken)
      const listResponseAsUserB = await global.request
        .get('/collections/frogs')
        .set('Authorization', 'Bearer ' + userBToken)
      const listResponseAsGuest = await global.request.get('/collections/frogs')

      const detailResponseAsUserA = await global.request
        .get(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userAToken)

      const detailResponseAsUserB = await global.request
        .get(`/collections/frogs/${frogCreateResponseForUserB.body.id}`)
        .set('Authorization', 'Bearer ' + userBToken)

      const detailResponseAsUserAGettingUserBRecord = await global.request
        .get(`/collections/frogs/${frogCreateResponseForUserB.body.id}`)
        .set('Authorization', 'Bearer ' + userAToken)
      const detailResponseAsUserBGettingUserARecord = await global.request
        .get(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userBToken)

      expect(listResponseAsUserA.status).toBe(200)
      expect(listResponseAsUserB.status).toBe(200)
      expect(listResponseAsGuest.status).toBe(403)
      expect(listResponseAsUserA.body.data.length).toBe(1)
      expect(listResponseAsUserB.body.data.length).toBe(1)
      expect(listResponseAsUserA.body.data[0].user.id).toBe(userAID)
      expect(listResponseAsUserB.body.data[0].user.id).toBe(userBID)

      expect(detailResponseAsUserA.status).toBe(200)
      expect(detailResponseAsUserB.status).toBe(200)
      expect(detailResponseAsUserAGettingUserBRecord.status).toBe(404)
      expect(detailResponseAsUserBGettingUserARecord.status).toBe(404)
    })

    it("should allow update only for owner's records", async () => {
      // Create 2 users.
      const userASignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'usera3@example.com',
          password: 'password'
        })
      const userAToken = userASignupResponse.body.token

      const userBSignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'userb3@example.com',
          password: 'password'
        })
      const userBToken = userBSignupResponse.body.token

      // Get their IDs.
      const userAID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userAToken)
        .then((res) => res.body.id)
      const userBID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userBToken)
        .then((res) => res.body.id)

      // Create one record for each user.
      const frogCreateResponseForUserA = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User A',
          userId: userAID
        })
        .set('Authorization', 'Bearer ' + userAToken)

      const frogCreateResponseForUserB = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User B',
          userId: userBID
        })
        .set('Authorization', 'Bearer ' + userBToken)

      expect(frogCreateResponseForUserA.status).toBe(201)
      expect(frogCreateResponseForUserB.status).toBe(201)

      const putResponseAsUserAWithFrogA = await global.request
        .put(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userAToken)
        .send({ name: 'Updated Frog A for User A', userId: userAID })

      const patchResponseAsUserAWithFrogA = await global.request
        .patch(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userAToken)
        .send({ name: 'Patched Frog A for User A' })

      const putResponseAsUserBWithFrogA = await global.request
        .put(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userBToken)
        .send({ name: 'Updated Frog A with User B', userId: userBID })

      const patchResponseAsUserBWithFrogA = await global.request
        .patch(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userBToken)
        .send({ name: 'Patched Frog A with User B' })

      expect(putResponseAsUserAWithFrogA.status).toBe(200)
      expect(patchResponseAsUserAWithFrogA.status).toBe(200)
      expect(putResponseAsUserBWithFrogA.status).toBe(403)
      expect(patchResponseAsUserBWithFrogA.status).toBe(403)
    })

    it('should prevent changing ownership of a record', async () => {
      // Create 2 users.
      const userASignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'usera4@example.com',
          password: 'password'
        })
      const userAToken = userASignupResponse.body.token

      const userBSignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'userb4@example.com',
          password: 'password'
        })
      const userBToken = userBSignupResponse.body.token

      // Get their IDs.
      const userAID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userAToken)
        .then((res) => res.body.id)
      const userBID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userBToken)
        .then((res) => res.body.id)

      // Create one record for each user.
      const frogCreateResponseForUserA = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User A',
          userId: userAID
        })
        .set('Authorization', 'Bearer ' + userAToken)

      const frogUpdateResponseAsUserA = await global.request
        .put(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userAToken)
        .send({ name: 'Updated Frog for User A', userId: userAID })

      const frogUpdateResponseChangingOwnership = await global.request
        .put(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userAToken)
        .send({ name: 'Updated Frog for User A', userId: userBID })

      const frogUpdateResponseChangingOwnershipAsUserB = await global.request
        .put(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userBToken)
        .send({ name: 'Updated Frog for User A', userId: userBID })

      expect(frogCreateResponseForUserA.status).toBe(201)
      expect(frogUpdateResponseAsUserA.status).toBe(200)
      expect(frogUpdateResponseChangingOwnership.status).toBe(403)
      expect(frogUpdateResponseChangingOwnershipAsUserB.status).toBe(403)
    })

    it("should allow delete only for owner's records", async () => {
      // Create 2 users.
      const userASignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'usera5@example.com',
          password: 'password'
        })
      const userAToken = userASignupResponse.body.token

      const userBSignupResponse = await global.request
        .post('/auth/users/signup')
        .send({
          email: 'userb5@example.com',
          password: 'password'
        })
      const userBToken = userBSignupResponse.body.token

      // Get their IDs.
      const userAID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userAToken)
        .then((res) => res.body.id)
      const userBID = await global.request
        .get('/auth/users/me')
        .set('Authorization', 'Bearer ' + userBToken)
        .then((res) => res.body.id)

      // Create one record for each user.
      const frogCreateResponseForUserA = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User A',
          userId: userAID
        })
        .set('Authorization', 'Bearer ' + userAToken)

      const frogCreateResponseForUserB = await global.request
        .post('/collections/frogs')
        .send({
          name: 'Frog for User B',
          userId: userBID
        })
        .set('Authorization', 'Bearer ' + userBToken)

      expect(frogCreateResponseForUserA.status).toBe(201)
      expect(frogCreateResponseForUserB.status).toBe(201)

      const deleteResponseAsUserAWithFrogA = await global.request
        .delete(`/collections/frogs/${frogCreateResponseForUserA.body.id}`)
        .set('Authorization', 'Bearer ' + userAToken)

      const deleteResponseAsUserAWithFrogB = await global.request
        .delete(`/collections/frogs/${frogCreateResponseForUserB.body.id}`)
        .set('Authorization', 'Bearer ' + userAToken)

      expect(deleteResponseAsUserAWithFrogA.status).toBe(200)
      expect(deleteResponseAsUserAWithFrogB.status).toBe(403)
    })
  })

  describe('Forbidden rules', () => {
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
  })

  describe('Admin rules and admin role', () => {
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
        .get(`/collections/cats/${catId}`)
        .set('Authorization', 'Bearer ' + adminToken)

      const responseAsUser = await global.request
        .get(`/collections/cats/${catId}`)
        .set('Authorization', 'Bearer ' + userToken)

      const responseAsGuest = await global.request.get(
        `/collections/cats/${catId}`
      )

      expect(responseAsAdmin.body.name).toBeDefined()
      expect(responseAsUser.body.name).toBeDefined()
      expect(responseAsGuest.body.name).toBeDefined()

      expect(responseAsAdmin.body.hiddenProp).toBeDefined()
      expect(responseAsUser.body.hiddenProp).not.toBeDefined()
      expect(responseAsGuest.body.hiddenProp).not.toBeDefined()
    })

    it('admins are not concerned by any of ownership based access policies', async () => {
      // TODO: Create
      // TODO: Read
      // TODO: Update
      // TODO: Delete
    })
  })
})
