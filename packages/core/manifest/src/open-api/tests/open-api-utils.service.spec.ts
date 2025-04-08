import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiUtilsService } from '../services/open-api-utils.service'
import { PolicyManifest } from '../../../../types/src'

describe('OpenApiUtilsService', () => {
  let service: OpenApiUtilsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiUtilsService]
    }).compile()

    service = module.get<OpenApiUtilsService>(OpenApiUtilsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getSecurityRequirements', () => {
    it('should return security requirements for restricted policies', () => {
      const policies: PolicyManifest[] = [
        { access: 'restricted', allow: ['User', 'Admin'] }
      ]
      const result = service.getSecurityRequirements(policies)
      expect(result).toEqual([{ Admin: [], User: [] }])
    })

    it('should return security requirements for public policies', () => {
      const policies: PolicyManifest[] = [{ access: 'public' }]
      const result = service.getSecurityRequirements(policies)
      expect(result).toEqual([])
    })
  })
})
