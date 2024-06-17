import { load } from 'js-yaml'
import fs from 'fs'

export const mockYamlService = {
  load: () =>
    load(
      fs.readFileSync(`${process.cwd()}/e2e/assets/mock-backend.yml`, 'utf8')
    )
}
