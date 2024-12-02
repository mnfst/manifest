import { DEFAULT_ADMIN_CREDENTIALS } from '../../src/constants'

describe('Single CRUD (e2e)', () => {
  const dummyContactPage = {
    title: 'Contact',
    content: 'lorem ipsum'
  }

  let adminToken: string

  beforeAll(async () => {
    // Get admin token (login as default admin).
    const adminLoginResponse = await global.request
      .post('/auth/admins/login')
      .send(DEFAULT_ADMIN_CREDENTIALS)
    adminToken = adminLoginResponse.body.token
  })

  it('cannot create a single entity', async () => {
    const response = await global.request
      .post('/singles/contact')
      .send(dummyContactPage)

    expect(response.status).toBe(404)
  })

  it('cannot delete a single entity', async () => {
    const response = await global.request.delete('/singles/contact/1')

    expect(response.status).toBe(404)
  })

  it('cannot get select options of a single entity', async () => {
    const response = await global.request.get('/singles/contact/select-options')

    expect(response.status).toBe(404)
  })

  describe('GET /singles/:entity', () => {
    it('should always return one item even if empty (creates blank one)', async () => {
      const response = await global.request.get('/singles/contact')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject<{ title: string; content: string }>({
        title: null,
        content: null
      })
    })
  })

  describe('PUT /collections/:entity', () => {
    it('can update a single entity', async () => {
      const newTitle: string = 'Contact Us'

      const response = await global.request
        .put('/singles/contact')
        .send({
          title: newTitle
        })
        .set('Authorization', 'Bearer ' + adminToken)

      expect(response.status).toBe(200)

      const updatedResponse = await global.request.get('/singles/contact')

      expect(updatedResponse.status).toBe(200)
      expect(updatedResponse.body.title).toBe(newTitle)
    })

    it('validates the fields of a single entity', async () => {
      const response = await global.request
        .put('/singles/contact')
        .send({
          title: ''
        })
        .set('Authorization', 'Bearer ' + adminToken)

      expect(response.status).toBe(400)
    })
  })
})
