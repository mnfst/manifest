import { Paginator, SelectOption } from '@repo/types'
import { DEFAULT_ADMIN_CREDENTIALS } from '../../src/constants'

describe('Collection CRUD (e2e)', () => {
  const dummyDog = {
    name: 'Fido',
    age: 5,
    website: 'https://example.com',
    description: 'lorem ipsum',
    birthdate: '2024-01-01',
    price: 100,
    isGoodBoy: true,
    acquiredAt: '2025-01-05T08:19:02.000Z',
    email: 'test@example.com',
    favoriteToy: 'ball',
    location: { lat: 12, lng: 13 }
  }
  let adminToken: string

  beforeAll(async () => {
    const adminLoginResponse = await global.request
      .post('/auth/admins/login')
      .send(DEFAULT_ADMIN_CREDENTIALS)
    adminToken = adminLoginResponse.body.token
  })

  describe('POST /collections/:entity', () => {
    it('should create an item', async () => {
      const response = await global.request
        .post('/collections/dogs')
        .send(dummyDog)

      expect(response.status).toBe(201)
    })

    it('should add default values', async () => {
      const response = await global.request.post('/collections/sheep').send({})

      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        name: 'Dolly',
        description: 'A fluffy sheep.',
        age: 5,
        website: 'https://example.com',
        price: 100,
        birthdate: '2020-01-01',
        isGoodBoy: true,
        acquiredAt: '2020-01-01T00:00:00Z',
        email: 'test@test.com'
      })
    })
  })

  describe('GET /collections/:entity', () => {
    it('should return all items', async () => {
      const response = await global.request.get('/collections/dogs')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject<Paginator<any>>({
        data: expect.any(Array),
        currentPage: expect.any(Number),
        lastPage: expect.any(Number),
        from: expect.any(Number),
        to: expect.any(Number),
        total: expect.any(Number),
        perPage: expect.any(Number)
      })
      expect(response.body.data.length).toBe(1)
    })

    it('should filter items by field', async () => {
      const response = await global.request.get(
        `/collections/dogs?name_eq=${dummyDog.name}`
      )

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(1)
    })

    it('should filter items by relationship', async () => {
      const bigNumber: number = 999

      const response = await global.request.get(
        `/collections/dogs?relations=owner&owner.id_eq=${bigNumber}`
      )

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(0)
    })

    it('should return a 400 error if the filter field does not exist', async () => {
      const response = await global.request.get(
        `/collections/dogs?invalidField_eq=${dummyDog.name}`
      )

      expect(response.status).toBe(400)
    })
  })

  describe('GET /collections/:entity/select-options', () => {
    it('should get select options only if I am admin', async () => {
      const response = await global.request.get(
        '/collections/dogs/select-options'
      )

      const adminResponse = await global.request
        .get('/collections/dogs/select-options')
        .set('Authorization', 'Bearer ' + adminToken)

      expect(response.status).toBe(403)
      expect(adminResponse.status).toBe(200)
      expect(adminResponse.body).toMatchObject<SelectOption[]>([
        {
          label: dummyDog.name,
          id: 1
        }
      ])
    })
  })

  describe('GET /collections/:entity/:id', () => {
    it('should return an item', async () => {
      const response = await global.request.get('/collections/dogs/1')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject(dummyDog)
    })
  })

  describe('PUT /collections/:entity/:id', () => {
    it('should fully update an item', async () => {
      const newName = 'Rex'

      const response = await global.request.put('/collections/dogs/1').send({
        name: newName
      })

      expect(response.status).toBe(200)

      const updatedResponse = await global.request.get('/collections/dogs/1')

      expect(updatedResponse.status).toBe(200)
      expect(updatedResponse.body).toMatchObject({
        name: newName
      })
    })
  })

  describe('PATCH /collections/:entity/:id', () => {
    it('should patch an item', async () => {
      const postResponse = await global.request
        .post('/collections/dogs')
        .send(dummyDog)

      const newAge = 6

      const response = await global.request
        .patch(`/collections/dogs/${postResponse.body.id}`)
        .send({
          age: newAge
        })

      expect(response.status).toBe(200)

      const updatedResponse = await global.request.get(
        `/collections/dogs/${postResponse.body.id}`
      )

      expect(updatedResponse.status).toBe(200)
      expect(updatedResponse.body).toMatchObject({
        ...dummyDog,
        age: newAge
      })
    })

    it('should keep relations if not provided', async () => {
      const createOwnerResponse = await global.request
        .post('/collections/owners')
        .send({
          name: 'John Doe'
        })
        .set('Authorization', 'Bearer ' + adminToken)

      const dogWithOwner = {
        name: 'Charlie',
        ownerId: createOwnerResponse.body.id
      }

      const createResponse = await global.request
        .post('/collections/dogs')
        .send(dogWithOwner)
        .set('Authorization', 'Bearer ' + adminToken)

      expect(createResponse.status).toBe(201)

      const updateResponse = await global.request
        .patch(`/collections/dogs/${createResponse.body.id}`)
        .send({
          name: 'Charlie 2'
        })
        .set('Authorization', 'Bearer ' + adminToken)

      expect(updateResponse.status).toBe(200)

      const fetchResponse = await global.request
        .get(`/collections/dogs/${createResponse.body.id}?relations=owner`)
        .set('Authorization', 'Bearer ' + adminToken)

      expect(fetchResponse.status).toBe(200)
      expect(fetchResponse.body?.owner?.id).toEqual(1)
    })
  })

  describe('DELETE /collections/:entity/:id', () => {
    it('should delete an item', async () => {
      const response = await global.request.delete('/collections/dogs/1')

      expect(response.status).toBe(200)

      const updatedResponse = await global.request.get('/collections/dogs/1')

      expect(updatedResponse.status).toBe(404)
    })
  })
})
