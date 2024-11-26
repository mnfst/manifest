import { Paginator, SelectOption } from '@repo/types'

describe('CRUD (e2e)', () => {
  const dummyDog = {
    name: 'Fido',
    age: 5,
    website: 'https://example.com',
    description: 'lorem ipsum',
    birthdate: '2024-01-01',
    price: 100,
    isGoodBoy: true,
    acquiredAt: new Date().getTime(),
    email: 'test@example.com',
    favoriteToy: 'ball',
    location: { lat: 12, lng: 13 }
  }

  it('POST /collections/:entity', async () => {
    const response = await global.request
      .post('/collections/dogs')
      .send(dummyDog)

    expect(response.status).toBe(201)
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

  it('GET /collections/:entity/select-options', async () => {
    const response = await global.request.get(
      '/collections/dogs/select-options'
    )

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject<SelectOption[]>([
      {
        label: dummyDog.name,
        id: 1
      }
    ])
  })

  it('GET /collections/:entity/:id', async () => {
    const response = await global.request.get('/collections/dogs/1')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject(dummyDog)
  })

  it('PUT /collections/:entity/:id', async () => {
    const newName = 'Rex'

    const response = await global.request.put('/collections/dogs/1').send({
      name: newName
    })

    expect(response.status).toBe(200)

    const updatedResponse = await global.request.get('/collections/dogs/1')

    expect(updatedResponse.status).toBe(200)
    expect(updatedResponse.body).toMatchObject({
      ...dummyDog,
      name: newName
    })
  })

  it('DELETE /collections/:entity/:id', async () => {
    const response = await global.request.delete('/collections/dogs/1')

    expect(response.status).toBe(200)

    const updatedResponse = await global.request.get('/collections/dogs/1')

    expect(updatedResponse.status).toBe(404)
  })
})
