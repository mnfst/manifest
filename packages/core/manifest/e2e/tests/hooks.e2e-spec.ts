import express from 'express'
import { Server } from 'http'

interface ReceivedWebhook {
  path: string
  method: string
  headers: express.Request['headers']
  body: any
  query: any
}

describe('Hooks (e2e)', () => {
  let webhookCatcher: express.Application
  let server: Server
  let receivedWebhooks: ReceivedWebhook[] = []

  beforeAll((done) => {
    webhookCatcher = express()
    webhookCatcher.use(express.json())

    webhookCatcher.all('*', (req, res) => {
      receivedWebhooks.push({
        path: req.path,
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query
      })
      res.status(200).send('ok')
    })

    server = webhookCatcher.listen(9999, done)
  })

  afterAll((done) => {
    server.close(done)
  })

  beforeEach(() => {
    receivedWebhooks = []
  })

  // Small delay to allow the async webhook to be processed.
  const waitForWebhook = () =>
    new Promise((resolve) => setTimeout(resolve, 100))

  describe('webhooks', () => {
    it('should send an HTTP request', async () => {
      await global.request
        .post('/collections/webhook-testers')
        .send({ name: 'Test' })
        .expect(201)

      await waitForWebhook()

      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].path).toBe('/webhooks-e2e')
    })

    it('should be a POST request by default', async () => {
      await global.request
        .post('/collections/webhook-testers')
        .send({ name: 'Test' })
        .expect(201)

      await waitForWebhook()

      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].method).toBe('POST')
      expect(receivedWebhooks[0].body.event).toBe('afterCreate')
      expect(receivedWebhooks[0].body.entity).toBe('webhook-testers')
      expect(receivedWebhooks[0].body.record.name).toBe('Test')
    })

    it('should be able to send a GET request', async () => {
      await global.request
        .post('/collections/webhook-gets')
        .send({ name: 'Test' })
        .expect(201)

      await waitForWebhook()

      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].method).toBe('GET')
    })

    it('should be able to send a PUT request', async () => {
      await global.request
        .post('/collections/webhook-puts')
        .send({ name: 'Test' })
        .expect(201)

      await waitForWebhook()

      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].method).toBe('PUT')
    })

    it('should be able to send a PATCH request', async () => {
      await global.request
        .post('/collections/webhook-patches')
        .send({ name: 'Test' })
        .expect(201)

      await waitForWebhook()

      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].method).toBe('PATCH')
    })

    it('should be able to send a DELETE request', async () => {
      await global.request
        .post('/collections/webhook-deletes')
        .send({ name: 'Test' })
        .expect(201)

      await waitForWebhook()

      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].method).toBe('DELETE')
    })

    it('should set the request headers', async () => {
      await global.request
        .post('/collections/webhook-testers')
        .send({ name: 'Test' })
        .expect(201)

      await waitForWebhook()

      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].headers['x-test-header']).toBe('e2e-test')
    })

    it('should integrate dotenv variables', async () => {
      await global.request
        .post('/collections/webhook-with-headers')
        .send({ name: 'Test' })
        .expect(201)

      await waitForWebhook()

      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].path).toBe('/webhooks-e2e-from-env')
      expect(receivedWebhooks[0].headers['authorization']).toBe('Bearer test')
    })

    it('should not care if the request fails', async () => {
      const response = await global.request
        .post('/collections/webhook-fails')
        .send({ name: 'Test' })

      await waitForWebhook()

      expect(response.status).toBe(201)
      expect(receivedWebhooks.length).toBe(0)
    })

    it('should be hookable on different events', async () => {
      // afterCreate
      const createResponse = await global.request
        .post('/collections/webhook-events')
        .send({ name: 'Test' })
      expect(createResponse.status).toBe(201)
      await waitForWebhook()
      expect(receivedWebhooks.length).toBe(1)
      expect(receivedWebhooks[0].body.event).toBe('afterCreate')

      // afterUpdate
      const createdId = createResponse.body.id
      const updateResponse = await global.request
        .patch(`/collections/webhook-events/${createdId}`)
        .send({ name: 'Updated' })
      expect(updateResponse.status).toBe(200)
      await waitForWebhook()
      expect(receivedWebhooks.length).toBe(2)
      expect(receivedWebhooks[1].body.event).toBe('afterUpdate')

      // afterDelete
      const deleteResponse = await global.request.delete(
        `/collections/webhook-events/${createdId}`
      )
      expect(deleteResponse.status).toBe(200)
      await waitForWebhook()
      expect(receivedWebhooks.length).toBe(3)
      expect(receivedWebhooks[2].body.event).toBe('afterDelete')
    })

    it('should trigger webhooks on single entity events', async () => {
      await global.request.get('/singles/webhook-single').expect(200)

      await global.request
        .put('/singles/webhook-single')
        .send({ title: 'New Title' })
        .expect(200)

      await waitForWebhook()

      expect(receivedWebhooks[0].path).toBe('/webhooks-e2e')
      expect(receivedWebhooks[0].method).toBe('POST')
      expect(receivedWebhooks[0].body.event).toBe('afterUpdate')
      expect(receivedWebhooks[0].body.entity).toBe('webhook-single')
      expect(receivedWebhooks[0].body.record.title).toBe('New Title')
    })
  })
})