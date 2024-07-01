describe('Authentication (e2e)', () => {
  describe('Admin', () => {
    it('can log in as admin', async () => {})

    it('can get my current user as admin', async () => {})

    it('cannot signup as an admin', async () => {})
  })

  describe('Authenticable entity', () => {
    it('can log in as authenticable entity', async () => {})

    it('can get my current user as authenticable entity', async () => {})

    it('can signup if signup rule is public', async () => {})

    it('cannot signup if signup rule is not public', async () => {})
  })

  describe('Other entity', () => {
    it('cannot log in as other entity', async () => {})

    it('cannot get my current user as other entity', async () => {})

    it('cannot signup as other entity', async () => {})
  })
})
