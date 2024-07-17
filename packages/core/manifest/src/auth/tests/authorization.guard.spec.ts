import { AuthorizationGuard } from '../guards/authorization.guard'

describe('AuthorizationGuard', () => {
  it('should be defined', () => {
    expect(new AuthorizationGuard()).toBeDefined()
  })
})
