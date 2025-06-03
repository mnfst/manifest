describe('Relationship (e2e)', () => {
  let dummyPost: any
  let authorId: string

  beforeAll(async () => {
    authorId = (
      await global.request.post('/collections/authors').send({
        name: 'Example Author'
      })
    ).body.id

    dummyPost = {
      title: 'Example Post',
      content: 'This is an example post content.',
      authorId
    }
  })

  describe('ManyToOne', () => {
    it('can create a many to one relationship and query it from child to parent', async () => {
      const createResponse = await global.request
        .post('/collections/posts')
        .send(dummyPost)

      const fetchedPost = await global.request.get(
        `/collections/posts/${createResponse.body.id}?relations=author`
      )

      expect(createResponse.status).toBe(201)
      expect(fetchedPost.status).toBe(200)
      expect(fetchedPost.body.author.id).toBe(dummyPost.authorId)
    })

    it('can query a many to one relationship from parent to child', async () => {
      const createResponse = await global.request
        .post('/collections/posts')
        .send(dummyPost)

      const fetchedAuthor = await global.request.get(
        `/collections/authors/${dummyPost.authorId}?relations=posts`
      )

      expect(createResponse.status).toBe(201)
      expect(fetchedAuthor.status).toBe(200)
      expect(fetchedAuthor.body.posts.map((p) => p.id)).toContain(
        createResponse.body.id
      )
    })

    it('many to one relationship is nullable', async () => {
      const createResponse = await global.request
        .post('/collections/posts')
        .send({
          title: 'Post without author',
          content: 'Post content'
        })

      const fetchedPost = await global.request.get(
        `/collections/posts/${createResponse.body.id}?relations=author`
      )

      expect(createResponse.status).toBe(201)
      expect(fetchedPost.status).toBe(200)
      expect(fetchedPost.body.author).toBeNull()
    })

    it('eager many to one relations are loaded by default', async () => {
      const fetchResponse = await global.request.get('/collections/notes')

      expect(fetchResponse.status).toBe(200)
      expect(fetchResponse.body.data[0].author.id).toEqual(expect.any(String))
    })

    it('can filter by a many to one relationship', async () => {
      const newAuthor = {
        name: 'Author name'
      }
      const veryBigNumber = '9999'

      const createAuthorResponse = await global.request
        .post('/collections/authors')
        .send(newAuthor)

      await global.request.post('/collections/posts').send({
        title: 'Post title',
        content: 'Post content',
        authorId: createAuthorResponse.body.id
      })

      const filteredResponse = await global.request.get(
        `/collections/posts?relations=author&author.id_eq=${createAuthorResponse.body.id}`
      )
      const nonExistentAuthorResponse = await global.request.get(
        `/collections/posts?relations=author&author.id_eq=${veryBigNumber}`
      )

      expect(filteredResponse.status).toBe(200)
      expect(filteredResponse.body.data.length).toBe(1)

      expect(nonExistentAuthorResponse.status).toBe(200)
      expect(nonExistentAuthorResponse.body.data.length).toBe(0)
    })

    it('can query nested many to one relationships from child => parent => parent', async () => {
      const newUniversity = {
        name: 'University Name'
      }
      const createUniversityResponse = await global.request
        .post('/collections/universities')
        .send(newUniversity)

      const newAuthor = {
        name: 'Author name',
        universityId: createUniversityResponse.body.id
      }

      const createAuthorResponse = await global.request
        .post('/collections/authors')
        .send(newAuthor)

      const createPostResponse = await global.request
        .post('/collections/posts')
        .send({
          title: 'Post title',
          content: 'Post content',
          authorId: createAuthorResponse.body.id
        })

      const listResponse = await global.request.get(
        `/collections/posts?relations=author,author.university`
      )
      const detailResponse = await global.request.get(
        `/collections/posts/${createPostResponse.body.id}?relations=author,author.university`
      )

      expect(listResponse.status).toBe(200)
      expect(
        listResponse.body.data.find((p) => p.id === createPostResponse.body.id)
          ?.author?.university?.id
      ).toEqual(expect.any(String))

      expect(detailResponse.status).toBe(200)
      expect(detailResponse.body.author.university.id).toEqual(
        expect.any(String)
      )
    })

    it('can query nested many to one relationships from parent => child => child', async () => {
      const newUniversity = {
        name: 'University Name'
      }
      const createUniversityResponse = await global.request
        .post('/collections/universities')
        .send(newUniversity)

      const newAuthor = {
        name: 'Author name',
        universityId: createUniversityResponse.body.id
      }

      const createAuthorResponse = await global.request
        .post('/collections/authors')
        .send(newAuthor)

      const createPostResponse = await global.request
        .post('/collections/posts')
        .send({
          title: 'Post title',
          content: 'Post content',
          authorId: createAuthorResponse.body.id
        })

      const fetchedUniversity = await global.request.get(
        `/collections/universities/${createUniversityResponse.body.id}?relations=authors,authors.posts`
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
        .post('/collections/authors')
        .send({
          name: 'Author name'
        })

      await global.request.post('/collections/posts').send({
        title: 'Post title',
        content: 'Post content',
        authorId: createAuthorResponse.body.id
      })

      const deleteResponse = await global.request.delete(
        `/collections/authors/${createAuthorResponse.body.id}`
      )

      expect(deleteResponse.status).toBe(400)
    })
  })

  describe('ManyToMany', () => {
    it('can create a many to many relationship', async () => {
      const fetchTagResponse = await global.request.get('/collections/tags')
      const dummyTagIds = fetchTagResponse.body.data
        .slice(0, 2)
        .map((tag) => tag.id)

      const createResponse = await global.request
        .post('/collections/posts')
        .send({
          title: 'My new post',
          content: 'Post content',
          tagIds: dummyTagIds
        })

      const fetchedPost = await global.request.get(
        `/collections/posts/${createResponse.body.id}?relations=tags`
      )

      console.log(fetchedPost.body.tags, dummyTagIds)

      expect(createResponse.status).toBe(201)
      expect(fetchedPost.status).toBe(200)
      expect(fetchedPost.body.tags.length).toBe(dummyTagIds.length)
      expect(fetchedPost.body.tags.map((tag) => tag.id)).toEqual(
        expect.arrayContaining(dummyTagIds)
      )
    })

    it('can update a many to many relationship', async () => {
      const fetchTagResponse = await global.request.get('/collections/tags')

      const dummyTagIds = fetchTagResponse.body.data
        .map((tag) => tag.id)
        .slice(0, 2)
      const otherTagIds = fetchTagResponse.body.data
        .map((tag) => tag.id)
        .slice(2, 5)

      const createResponse = await global.request
        .post('/collections/posts')
        .send({
          title: 'Post title',
          content: 'Post content',
          tagIds: dummyTagIds
        })

      const updateResponse = await global.request
        .put(`/collections/posts/${createResponse.body.id}`)
        .send({
          tagIds: otherTagIds
        })

      const fetchedPost = await global.request.get(
        `/collections/posts/${createResponse.body.id}?relations=tags`
      )

      expect(updateResponse.status).toBe(200)
      expect(fetchedPost.status).toBe(200)
      expect(fetchedPost.body.tags.map((tag) => tag.id)).toEqual(
        expect.arrayContaining(otherTagIds)
      )
    })

    it('can remove a many to many relationship', async () => {
      const dummyTagIds = [1, 3]

      const createResponse = await global.request
        .post('/collections/posts')
        .send({
          title: 'Post title',
          content: 'Post content',
          tagIds: dummyTagIds
        })

      const updateResponse = await global.request
        .put(`/collections/posts/${createResponse.body.id}`)
        .send({
          tagIds: []
        })

      const fetchedPost = await global.request.get(
        `/collections/posts/${createResponse.body.id}?relations=tags`
      )

      expect(updateResponse.status).toBe(200)
      expect(fetchedPost.status).toBe(200)
      expect(fetchedPost.body.tags.length).toBe(0)
    })

    it('can query a many to many relationship from both sides', async () => {
      const fetchTagResponse = await global.request.get('/collections/tags')

      const dummyTagIds = fetchTagResponse.body.data
        .map((tag) => tag.id)
        .slice(3, 5)

      const createPostResponse = await global.request
        .post('/collections/posts')
        .send({
          title: 'Post title',
          content: 'Post content',
          tagIds: dummyTagIds
        })

      const fetchedPost = await global.request.get(
        `/collections/posts/${createPostResponse.body.id}?relations=tags`
      )

      const fetchedTag = await global.request.get(
        `/collections/tags/${dummyTagIds[0]}?relations=posts`
      )

      expect(createPostResponse.status).toBe(201)
      expect(fetchedPost.status).toBe(200)
      expect(fetchedTag.status).toBe(200)

      expect(fetchedPost.body.tags.map((tag) => tag.id)).toEqual(
        expect.arrayContaining(dummyTagIds)
      )
      expect(fetchedTag.body.posts.map((post) => post.id)).toContain(
        createPostResponse.body.id
      )
    })

    it('can query nested many to many relationships', async () => {
      const fetchTagResponse = await global.request.get('/collections/tags')

      const dummyTagIds = fetchTagResponse.body.data
        .map((tag) => tag.id)
        .slice(2, 4)

      const dummyAuthorId = (await global.request.get('/collections/authors'))
        .body.data[0].id

      const createPostResponse = await global.request
        .post('/collections/posts')
        .send({
          title: 'Post title',
          content: 'Post content',
          tagIds: dummyTagIds,
          authorId: dummyAuthorId
        })

      const fetchedAuthor = await global.request.get(
        `/collections/authors/${dummyAuthorId}?relations=posts,posts.tags`
      )

      expect(createPostResponse.status).toBe(201)
      expect(fetchedAuthor.status).toBe(200)
      expect(
        fetchedAuthor.body.posts
          .find((p) => p.id === createPostResponse.body.id)
          .tags.map((tag) => tag.id)
      ).toEqual(expect.arrayContaining(dummyTagIds))
    })

    it('eager manyToMany relations are loaded by default', async () => {
      const fetchTagResponse = await global.request.get('/collections/tags')

      const dummyTagIds = fetchTagResponse.body.data
        .map((tag) => tag.id)
        .slice(0, 2)

      const createTweetResponse = await global.request
        .post('/collections/tweets')
        .send({
          text: 'Tweet content',
          customTagNameIds: dummyTagIds
        })

      const fetchedTweet = await global.request.get(
        `/collections/tweets/${createTweetResponse.body.id}`
      )

      expect(createTweetResponse.status).toBe(201)
      expect(fetchedTweet.status).toBe(200)
      expect(fetchedTweet.body.customTagNames.map((tag) => tag.id)).toEqual(
        expect.arrayContaining(dummyTagIds)
      )
    })

    it('can filter by a many to many relationship', async () => {
      const createTagResponse = await global.request
        .post('/collections/tags')
        .send({
          name: 'Tag name'
        })

      await global.request.post('/collections/posts').send({
        title: 'Post title',
        content: 'Post content',
        tagIds: [createTagResponse.body.id]
      })

      const filteredResponse = await global.request.get(
        `/collections/posts?relations=tags&tags.id_eq=${createTagResponse.body.id}`
      )

      const nonExistentTagResponse = await global.request.get(
        `/collections/posts?relations=tags&tags.id_eq=9999`
      )

      expect(filteredResponse.status).toBe(200)
      expect(filteredResponse.body.data.length).toBe(1)

      expect(nonExistentTagResponse.status).toBe(200)
      expect(nonExistentTagResponse.body.data.length).toBe(0)
    })
  })
})
