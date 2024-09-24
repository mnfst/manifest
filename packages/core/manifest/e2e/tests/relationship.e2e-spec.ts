describe('Relationship', () => {
  const dummyPost = {
    title: 'Post title',
    content: 'Post content',
    authorId: 1
  }

  describe('ManyToOne', () => {
    it('can create a many to one relationship and query it from child to parent', async () => {
      const createResponse = await global.request
        .post('/dynamic/posts')
        .send(dummyPost)

      const fetchedPost = await global.request.get(
        `/dynamic/posts/${createResponse.body.id}?relations=author`
      )

      expect(createResponse.status).toBe(201)
      expect(fetchedPost.status).toBe(200)
      expect(fetchedPost.body.author.id).toBe(dummyPost.authorId)
    })

    it('can query a many to one relationship from parent to child', async () => {
      const createResponse = await global.request
        .post('/dynamic/posts')
        .send(dummyPost)

      const fetchedAuthor = await global.request.get(
        `/dynamic/authors/${dummyPost.authorId}?relations=posts`
      )

      expect(createResponse.status).toBe(201)
      expect(fetchedAuthor.status).toBe(200)
      expect(fetchedAuthor.body.posts.map((p) => p.id)).toContain(
        createResponse.body.id
      )
    })

    it('many to one relationship is nullable', async () => {
      const createResponse = await global.request.post('/dynamic/posts').send({
        title: 'Post without author',
        content: 'Post content'
      })

      const fetchedPost = await global.request.get(
        `/dynamic/posts/${createResponse.body.id}?relations=author`
      )

      expect(createResponse.status).toBe(201)
      expect(fetchedPost.status).toBe(200)
      expect(fetchedPost.body.author).toBeNull()
    })

    it('eager many to one relations are loaded by default', async () => {
      const fetchedNote = await global.request.get('/dynamic/notes/1')

      expect(fetchedNote.status).toBe(200)
      expect(fetchedNote.body.author.id).toEqual(expect.any(Number))
    })

    it('can filter by a many to one relationship', async () => {
      const newAuthor = {
        name: 'Author name'
      }
      const veryBigNumber = '9999'

      const createAuthorResponse = await global.request
        .post('/dynamic/authors')
        .send(newAuthor)

      await global.request.post('/dynamic/posts').send({
        title: 'Post title',
        content: 'Post content',
        authorId: createAuthorResponse.body.id
      })

      const filteredResponse = await global.request.get(
        `/dynamic/posts?relations=author&author.id_eq=${createAuthorResponse.body.id}`
      )
      const nonExistentAuthorResponse = await global.request.get(
        `/dynamic/posts?relations=author&author.id_eq=${veryBigNumber}`
      )

      expect(filteredResponse.status).toBe(200)
      expect(filteredResponse.body.data.length).toBe(1)

      expect(nonExistentAuthorResponse.status).toBe(200)
      expect(nonExistentAuthorResponse.body.data.length).toBe(0)
    })

    it('can query nested many to one relationships from child => parent => parent', async () => {
      const newAuthor = {
        name: 'Author name',
        universityId: 1
      }

      const createAuthorResponse = await global.request
        .post('/dynamic/authors')
        .send(newAuthor)

      await global.request.post('/dynamic/posts').send({
        title: 'Post title',
        content: 'Post content',
        authorId: createAuthorResponse.body.id
      })

      const listResponse = await global.request.get(
        `/dynamic/posts?relations=author,author.university`
      )
      const detailResponse = await global.request.get(
        `/dynamic/posts/1?relations=author,author.university`
      )

      expect(listResponse.status).toBe(200)
      expect(listResponse.body.data[0].author.university.id).toEqual(
        expect.any(Number)
      )

      expect(detailResponse.status).toBe(200)
      expect(detailResponse.body.author.university.id).toEqual(
        expect.any(Number)
      )
    })

    it('can query nested many to one relationships from parent => child => child', async () => {
      const dummyUniversityId = 5
      const newAuthor = {
        name: 'Author name',
        universityId: dummyUniversityId
      }

      const createAuthorResponse = await global.request
        .post('/dynamic/authors')
        .send(newAuthor)

      const createPostResponse = await global.request
        .post('/dynamic/posts')
        .send({
          title: 'Post title',
          content: 'Post content',
          authorId: createAuthorResponse.body.id
        })

      const fetchedUniversity = await global.request.get(
        `/dynamic/universities/${dummyUniversityId}?relations=authors,authors.posts`
      )

      expect(fetchedUniversity.status).toBe(200)
      expect(
        fetchedUniversity.body.authors
          .find((a) => a.id === createAuthorResponse.body.id)
          .posts.map((p) => p.id)
      ).toContain(createPostResponse.body.id)
    })

    it('restrict delete on parent entity with children', async () => {
      const createAuthorResponse = await global.request
        .post('/dynamic/authors')
        .send({
          name: 'Author name'
        })

      await global.request.post('/dynamic/posts').send({
        title: 'Post title',
        content: 'Post content',
        authorId: createAuthorResponse.body.id
      })

      const deleteResponse = await global.request.delete(
        `/dynamic/authors/${createAuthorResponse.body.id}`
      )

      expect(deleteResponse.status).toBe(400)
    })
  })

  describe('ManyToMany', () => {
    // it('can create a many to many relationship', async () => {
    //   const dummyTagIds = [1, 3]
    //   const createResponse = await global.request.post('/dynamic/posts').send({
    //     title: 'My new post',
    //     content: 'Post content'
    // tagIds: dummyTagIds
  })

  // const fetchedPost = await global.request.get(
  //   `/dynamic/posts/${createResponse.body.id}?relations=tags`
  // )

  // expect(createResponse.status).toBe(201)
  // expect(fetchedPost.status).toBe(200)
  // expect(fetchedPost.body.tags.length).toBe(dummyTagIds.length)
  // expect(fetchedPost.body.tags.map((tag) => tag.id)).toEqual(dummyTagIds)
  // })

  // it('can update a many to many relationship', async () => {
  //   const dummyTagIds = [1, 3]
  //   const otherTagIds = [2, 4, 5]

  //   const createResponse = await global.request.post('/dynamic/posts').send({
  //     title: 'Post title',
  //     content: 'Post content',
  //     tagIds: dummyTagIds
  //   })

  //   const updateResponse = await global.request
  //     .put(`/dynamic/posts/${createResponse.body.id}`)
  //     .send({
  //       tagIds: otherTagIds
  //     })

  //   const fetchedPost = await global.request.get(
  //     `/dynamic/posts/${createResponse.body.id}?relations=tags`
  //   )

  //   expect(updateResponse.status).toBe(200)
  //   expect(fetchedPost.status).toBe(200)
  //   expect(fetchedPost.body.tags.map((tag) => tag.id)).toEqual(otherTagIds)
  // })

  // it('can remove a many to many relationship', async () => {
  //   const dummyTagIds = [1, 3]

  //   const createResponse = await global.request.post('/dynamic/posts').send({
  //     title: 'Post title',
  //     content: 'Post content',
  //     tagIds: dummyTagIds
  //   })

  //   const updateResponse = await global.request
  //     .put(`/dynamic/posts/${createResponse.body.id}`)
  //     .send({
  //       tagIds: []
  //     })

  //   const fetchedPost = await global.request.get(
  //     `/dynamic/posts/${createResponse.body.id}?relations=tags`
  //   )

  //   expect(updateResponse.status).toBe(200)
  //   expect(fetchedPost.status).toBe(200)
  //   expect(fetchedPost.body.tags.length).toBe(0)
  // })

  // it('can query a many to many relationship from both sides', async () => {
  //   const dummyTagIds = [1, 3]

  //   const createPostResponse = await global.request
  //     .post('/dynamic/posts')
  //     .send({
  //       title: 'Post title',
  //       content: 'Post content',
  //       tagIds: dummyTagIds
  //     })

  //   const fetchedPost = await global.request.get(
  //     `/dynamic/posts/${createPostResponse.body.id}?relations=tags`
  //   )

  //   const fetchedTag = await global.request.get(
  //     `/dynamic/tags/${dummyTagIds[0]}?relations=posts`
  //   )

  //   expect(createPostResponse.status).toBe(201)
  //   expect(fetchedPost.status).toBe(200)
  //   expect(fetchedTag.status).toBe(200)

  //   expect(fetchedPost.body.tags.map((tag) => tag.id)).toEqual(dummyTagIds)
  //   expect(fetchedTag.body.posts.map((post) => post.id)).toContain(
  //     createPostResponse.body.id
  //   )
  // })

  // it('can query nested many to many relationships', async () => {
  //   const dummyTagIds = [1, 3]
  //   const dummyAuthorId = 4

  //   const createResponse = await global.request.post('/dynamic/posts').send({
  //     title: 'Post title',
  //     content: 'Post content',
  //     tags: dummyTagIds.map((id) => ({ id })),
  //     authorId: dummyAuthorId
  //   })

  //   const fetchedAuthor = await global.request.get(
  //     `/dynamic/authors/${dummyAuthorId}?relations=posts,posts.tags`
  //   )

  //   expect(createResponse.status).toBe(201)
  //   expect(fetchedAuthor.status).toBe(200)
  //   expect(fetchedAuthor.body.posts[0].tags.map((tag) => tag.id)).toEqual(
  //     dummyTagIds
  //   )
  // })

  // it('eager manyToMany relations are loaded by default', async () => {
  //   const dummyTagIds = [1, 3]

  //   const createTweetResponse = await global.request
  //     .post('/dynamic/tweets')
  //     .send({
  //       text: 'Tweet content',
  //       customTagNameIds: dummyTagIds
  //     })

  //   const fetchedTweet = await global.request.get(
  //     `/dynamic/tweets/${createTweetResponse.body.id}`
  //   )

  //   expect(createTweetResponse.status).toBe(201)
  //   expect(fetchedTweet.status).toBe(200)
  //   expect(fetchedTweet.body.customTags.map((tag) => tag.id)).toEqual(
  //     dummyTagIds
  //   )
  // })

  // it('can filter by a many to many relationship', async () => {
  //   const createTagResponse = await global.request
  //     .post('/dynamic/tags')
  //     .send({
  //       name: 'Tag name'
  //     })

  //   await global.request.post('/dynamic/posts').send({
  //     title: 'Post title',
  //     content: 'Post content',
  //     tagIds: [createTagResponse.body.id]
  //   })

  //   const filteredResponse = await global.request.get(
  //     `/dynamic/posts?relations=tags&tags.id_eq=${createTagResponse.body.id}`
  //   )

  //   const nonExistentTagResponse = await global.request.get(
  //     `/dynamic/posts?relations=tags&tags.id_eq=9999`
  //   )

  //   expect(filteredResponse.status).toBe(200)
  //   expect(filteredResponse.body.data.length).toBe(1)

  //   expect(nonExistentTagResponse.status).toBe(200)
  //   expect(nonExistentTagResponse.body.data.length).toBe(0)
  // })
  // })
})
