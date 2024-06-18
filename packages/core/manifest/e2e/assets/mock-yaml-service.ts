import { load } from 'js-yaml'
import fs from 'fs'

// Mock the YamlService to load the mock-backend.yml file.
export const mockYamlService = {
  load: () =>
    load(
      fs.readFileSync(`${process.cwd()}/e2e/assets/mock-backend.yml`, 'utf8')
    )
}
