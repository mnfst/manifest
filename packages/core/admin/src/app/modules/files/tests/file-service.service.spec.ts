import { TestBed } from '@angular/core/testing'
import { FileService } from '../services/file.service'

describe('FileServiceService', () => {
  let service: FileService

  beforeEach(() => {
    TestBed.configureTestingModule({})
    service = TestBed.inject(FileService)
  })

  it('should be created', () => {
    expect(service).toBeTruthy()
  })
})
