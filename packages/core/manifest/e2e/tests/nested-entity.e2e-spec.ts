describe('Nested entity (e2e)', () => {
  it('should not allow fetching or creating nested entities directly', async () => {
    const fetchResponse = await global.request.get('/collections/steps')
    const createResponse = await global.request
      .post('/collections/steps')
      .send({ title: 'Test Step', description: 'This is a test step' })
    const updateResponse = await global.request
      .put('/collections/steps/1')
      .send({ title: 'Updated Step', description: 'This is an updated step' })
    const deleteResponse = await global.request.delete('/collections/steps/1')

    expect(fetchResponse.status).toBe(404)
    expect(createResponse.status).toBe(404)
    expect(updateResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
  })

  it('should eager load nested entities when fetching parent entity', async () => {
    const response = await global.request.get('/collections/tutorials')

    expect(response.status).toBe(200)
    expect(response.body.data[0]).toHaveProperty('steps')
    expect(Array.isArray(response.body.data[0].steps)).toBe(true)
  })

  it('should create multiple nested entities', async () => {
    const tutorial = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      steps: [
        {
          title: 'Step 1',
          description: 'This is the first step'
        },
        {
          title: 'Step 2',
          description: 'This is the second step'
        }
      ]
    }

    const response = await global.request
      .post('/collections/tutorials')
      .send(tutorial)

    expect(response.status).toBe(201)
    expect(response.body.steps).toHaveLength(2)
    expect(response.body.steps[0]).toHaveProperty('title', 'Step 1')
    expect(response.body.steps[1]).toHaveProperty('title', 'Step 2')
  })

  it('should create single nested entity', async () => {
    const tutorial = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      widget: {
        name: 'Test Widget',
        description: 'This is a test widget'
      }
    }

    const response = await global.request
      .post('/collections/tutorials')
      .send(tutorial)

    expect(response.status).toBe(201)
    expect(response.body.widget).toHaveProperty('name', 'Test Widget')
    expect(response.body.widget).toHaveProperty(
      'description',
      'This is a test widget'
    )
  })

  it('should update multiple nested entities', async () => {
    const tutorialDto = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      steps: [
        {
          title: 'Step 1',
          description: 'This is the first step'
        },
        {
          title: 'Step 2',
          description: 'This is the second step'
        }
      ]
    }

    const createResponse = await global.request
      .post('/collections/tutorials')
      .send(tutorialDto)

    expect(createResponse.status).toBe(201)

    const tutorial: any = createResponse.body

    tutorial.steps[0].title = 'Updated Step 1'
    tutorial.steps[1].title = 'Updated Step 2'

    const updateResponse = await global.request
      .put(`/collections/tutorials/${tutorial.id}`)
      .send(tutorial)
    const updatedTutorial = updateResponse.body

    expect(updateResponse.status).toBe(200)
    expect(updatedTutorial.steps).toHaveLength(2)
    expect(updatedTutorial.steps[0]).toHaveProperty('title', 'Updated Step 1')
    expect(updatedTutorial.steps[1]).toHaveProperty('title', 'Updated Step 2')

    // We make sure that we are not creating new steps, but updating existing ones.
    expect(updatedTutorial.steps[0]).toHaveProperty('id', tutorial.steps[0].id)
    expect(updatedTutorial.steps[1]).toHaveProperty('id', tutorial.steps[1].id)
  })

  it('should sync multiple nested entities', async () => {
    const tutorialDto = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      steps: [
        {
          title: 'Step 1',
          description: 'This is the first step'
        },
        {
          title: 'Step 2',
          description: 'This is the second step'
        }
      ]
    }

    const createResponse = await global.request
      .post('/collections/tutorials')
      .send(tutorialDto)

    expect(createResponse.status).toBe(201)

    const tutorial: any = createResponse.body

    // We replace the 2 existing steps with a new one.
    tutorial.steps = [
      {
        title: 'Step 3',
        description: 'This is the third step'
      }
    ]

    const updateResponse = await global.request
      .put(`/collections/tutorials/${tutorial.id}`)
      .send(tutorial)
    const updatedTutorial = updateResponse.body

    expect(updateResponse.status).toBe(200)
    expect(updatedTutorial.steps).toHaveLength(1)
    expect(updatedTutorial.steps[0]).toHaveProperty('title', 'Step 3')
  })

  it('should update single nested entity', async () => {
    const tutorial = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      widget: {
        name: 'Test Widget',
        description: 'This is a test widget'
      }
    }

    const response = await global.request
      .post('/collections/tutorials')
      .send(tutorial)

    expect(response.status).toBe(201)

    const createdTutorial = response.body

    createdTutorial.widget.name = 'Updated Widget'
    createdTutorial.widget.description = 'This is an updated widget'

    const updateResponse = await global.request
      .put(`/collections/tutorials/${createdTutorial.id}`)
      .send(createdTutorial)

    const updatedTutorial = updateResponse.body

    expect(updateResponse.status).toBe(200)
    expect(updatedTutorial.widget).toHaveProperty('name', 'Updated Widget')
    expect(updatedTutorial.widget).toHaveProperty(
      'description',
      'This is an updated widget'
    )
  })

  it('should delete multiple nested entities', async () => {
    const tutorialDto = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      steps: [
        {
          title: 'Step 1',
          description: 'This is the first step'
        },
        {
          title: 'Step 2',
          description: 'This is the second step'
        }
      ]
    }

    const createResponse = await global.request
      .post('/collections/tutorials')
      .send(tutorialDto)

    expect(createResponse.status).toBe(201)

    const tutorial: any = createResponse.body

    tutorial.steps = []

    const updateResponse = await global.request
      .put(`/collections/tutorials/${tutorial.id}`)
      .send(tutorial)
    const updatedTutorial = updateResponse.body
    expect(updateResponse.status).toBe(200)
    expect(updatedTutorial.steps).toHaveLength(0)
  })

  it('should delete single nested entity', async () => {
    const tutorial = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      widget: {
        name: 'Test Widget',
        description: 'This is a test widget'
      }
    }

    const response = await global.request
      .post('/collections/tutorials')
      .send(tutorial)

    expect(response.status).toBe(201)

    const createdTutorial = response.body

    createdTutorial.widget = null

    const updateResponse = await global.request
      .put(`/collections/tutorials/${createdTutorial.id}`)
      .send(createdTutorial)

    const updatedTutorial = updateResponse.body

    expect(updateResponse.status).toBe(200)
    expect(updatedTutorial.widget).toBeNull()
  })

  it('should cascade delete nested entities', async () => {
    const tutorialDto = {
      title: 'Test tutorial',
      content: 'This is a test tutorial',
      steps: [
        {
          title: 'Step 1',
          description: 'This is the first step'
        },
        {
          title: 'Step 2',
          description: 'This is the second step'
        }
      ]
    }

    const createResponse = await global.request
      .post('/collections/tutorials')
      .send(tutorialDto)

    expect(createResponse.status).toBe(201)

    const tutorial: any = createResponse.body

    const deleteResponse = await global.request.delete(
      `/collections/tutorials/${tutorial.id}`
    )

    expect(deleteResponse.status).toBe(200)
  })
})
