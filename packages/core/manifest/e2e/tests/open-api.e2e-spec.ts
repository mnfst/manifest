describe('OpenAPI (e2e)', () => {
  describe('Swagger UI', () => {
    it('Should generate an UI', async () => {
      const response = await global.request.get('/api')

      expect(response.status).toBe(200)
      expect(response.text).toContain('<html lang="en">')
    })
  })

  describe('OpenAPI file', () => {
    it('Should generate an OpenAPI file', async () => {
      return false // TODO: Implement this test
    })

    it('should include server information', async () => {
      return false // TODO: Implement this test
    })

    it('should include CRUD paths for entities', async () => {
      return false // TODO: Implement this test
    })

    it('should generate auth paths for admins and authenticable entities', async () => {
      return false // TODO: Implement this test
    })

    it('should generate endpoint paths', async () => {
      return false // TODO: Implement this test
    })

    it('should generate schemas for entities', async () => {
      return false // TODO: Implement this test
    })

    it('should generate DTO schemas for entities', async () => {
      return false // TODO: Implement this test
    })

    it('should generate general schemas', async () => {
      return false // TODO: Implement this test
    })
  })
})
