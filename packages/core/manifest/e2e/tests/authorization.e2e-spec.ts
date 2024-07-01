describe('Authorization (e2e)', () => {
  describe('Admin', () => {
    it('has access to admin, private and public entity rules', async () => {})

    it('has not access to locked entity rules', async () => {})

    it('admins are only visible to other admins', async () => {})
  })

  describe('Authenticable entity', () => {
    it('has access to its private and public entity rules', async () => {})

    it('has not access to other entity rules', async () => {})

    it('cannot manage admins', async () => {})
  })

  describe('Guest', () => {
    it('has access to public entity rules', async () => {})

    it('has not access to other entity rules', async () => {})

    it('cannot manage admins', async () => {})
  })
})
