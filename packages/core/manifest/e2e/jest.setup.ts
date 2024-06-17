import { mockTypeOrmOptions } from './assets/mock-type-orm-options'
import { mockYamlService } from './assets/mock-yaml-service'

let originalConsoleLog

beforeAll(() => {
  // Prevent console.log from printing to the console.
  originalConsoleLog = console.log
  console.log = jest.fn()

  // Mocks.
  global.MockYamlService = mockYamlService
  global.mockTypeOrmOptions = mockTypeOrmOptions
})

afterAll(() => {
  console.log = originalConsoleLog

  delete global.MockYamlService
})
