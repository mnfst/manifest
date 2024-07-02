import { Paginator, SelectOption } from '@mnfst/types'

describe('CRUD (e2e)', () => {
  const dummyDog = {
    name: 'Fido',
    age: 5,
    website: 'https://example.com',
    description: 'lorem ipsum',
    birthdate: new Date().toISOString(),
    password: 'password',
    price: 100,
    isGoodBoy: true,
    acquiredAt: new Date().toISOString(),
    email: 'test@example.com',
    favoriteToy: 'ball'
  }

  it('POST /dynamic/:entity', async () => {
    const response = await global.request.post('/dynamic/dogs').send(dummyDog)

    expect(response.status).toBe(201)
  })

  it('GET /dynamic/:entity', async () => {
    const response = await global.request.get('/dynamic/dogs')

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

  it('GET /dynamic/:entity/select-options', async () => {
    const response = await global.request.get('/dynamic/dogs/select-options')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject<SelectOption[]>([
      {
        label: dummyDog.name,
        id: 1
      }
    ])
  })

  it('GET /dynamic/:entity/:id', async () => {
    const response = await global.request.get('/dynamic/dogs/1')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject(dummyDog)
  })

  it('PUT /dynamic/:entity/:id', async () => {
    const newName = 'Rex'

    const response = await global.request.put('/dynamic/dogs/1').send({
      name: newName
    })

    expect(response.status).toBe(200)

    const updatedResponse = await global.request.get('/dynamic/dogs/1')

    expect(updatedResponse.status).toBe(200)
    expect(updatedResponse.body).toMatchObject({
      ...dummyDog,
      name: newName
    })
  })

  it('DELETE /dynamic/:entity/:id', async () => {
    const response = await global.request.delete('/dynamic/dogs/1')

    expect(response.status).toBe(200)

    const updatedResponse = await global.request.get('/dynamic/dogs/1')

    expect(updatedResponse.status).toBe(404)
  })
})
