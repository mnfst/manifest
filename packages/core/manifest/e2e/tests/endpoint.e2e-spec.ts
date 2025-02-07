describe('Endpoints (e2e)', () => {
  beforeEach(() => {})

  it('should trigger an endpoint', async () => {
    const response = await global.request
      .get('/endpoints/basic')
      .expect(JSON.stringify({ hello: 'OK' }))

    expect(response.status).toBe(200)
  })

  it('should throw a 404 if no endpoint is found', async () => {
    await global.request.get('/endpoints/unknown').expect(404)
  })

  it('should integrate the backend SDK into handlers', async () => {
    const response = await global.request
      .post('/endpoints/create-dog')
      .send({ name: 'Rex' })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ name: 'Rex' })
  })
})
