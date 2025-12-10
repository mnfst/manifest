import { AdminAccessGuard } from '../guards/admin-access.guard'

describe('AdminAccessGuard', () => {
  it('should be defined', () => {
    expect(new AdminAccessGuard()).toBeDefined()
  })
})
