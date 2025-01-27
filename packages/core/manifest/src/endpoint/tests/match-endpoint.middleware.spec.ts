import { MatchEndpointMiddleware } from '../middlewares/match-endpoint.middleware'

describe('MatchEndpointMiddleware', () => {
  it('should be defined', () => {
    expect(new MatchEndpointMiddleware()).toBeDefined()
  })
})
