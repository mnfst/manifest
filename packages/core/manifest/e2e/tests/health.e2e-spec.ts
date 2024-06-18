describe('Health (e2e)', () => {
  it('GET /health', () => {
    return global.request
      .get('/health')
      .expect(200)
      .expect(JSON.stringify({ status: 'OK' }))
  })
})
