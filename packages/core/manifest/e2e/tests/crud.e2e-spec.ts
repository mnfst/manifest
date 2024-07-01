import { Paginator, SelectOption } from '@mnfst/types'

describe('CRUD (e2e)', () => {
  const dummyDog = {
    name: 'Fido',
    age: 5
  }

  it('POST /dynamic/:entity', async () => {
    const response = await global.request.post('/dynamic/dogs').send(dummyDog)

    expect(response.status).toBe(201)
  })

  describe('GET /dynamic/:entity', () => {
    it('should return all items', async () => {
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

    it('should filter items by field', async () => {
      const response = await global.request.get(
        `/dynamic/dogs?name_eq=${dummyDog.name}`
      )

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(1)
    })

    it('should filter items by relationship', async () => {
      const bigNumber: number = 999

      const response = await global.request.get(
        `/dynamic/dogs?relations=owner&owner.id_eq=${bigNumber}`
      )

      expect(response.status).toBe(200)
      expect(response.body.data.length).toBe(0)
    })

    it('should return a 400 error if the filter field does not exist', async () => {
      const response = await global.request.get(
        `/dynamic/dogs?invalidField_eq=${dummyDog.name}`
      )

      expect(response.status).toBe(400)
    })
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
