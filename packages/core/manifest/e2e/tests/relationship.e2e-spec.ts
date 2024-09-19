describe('Relationship', () => {
  describe('BelongsTo', () => {
    it('can create a one to many relationship', async () => {})

    it('can update a one to many relationship', async () => {})

    it('relationship is mandatory by default', async () => {})

    it('nullable relationship are optional', async () => {})

    it('can query a one to many relationship from child to parent', async () => {})

    it('can query a one to many relationship from parent to child', async () => {})

    it('can query nested one to many relationships from child to parent', async () => {})

    it('can query nested one to many relationships from parent to child', async () => {})

    it('can query 2 nested one to many relationship from child to parent to child', async () => {})

    it('can query 2 nested one to many relationship from parent to child to parent', async () => {})

    it('eager relationship loads relation by default', async () => {})

    it('can filter by a one to many relationship', async () => {})

    it('can sort by a one to many relationship', async () => {})

    it('restrict delete on parent entity with children', async () => {})
  })

  describe('Many to Many', () => {
    it('creates a join table for many to many relationships on the declaration side', async () => {})

    it('can create a many to many relationship', async () => {})

    it('can update a many to many relationship', async () => {})

    it('can query a many to many relationship from both sides', async () => {})

    it('can query nested many to many relationships', async () => {})

    it('eager relationship loads relation by default', async () => {})

    it('can filter by a many to many relationship', async () => {})

    it('can sort by a many to many relationship', async () => {})

    it('can delete a many to many relationship', async () => {})

    it('if the relationship is specified in both sides, the join table is created only once', async () => {})
  })
})
