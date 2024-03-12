import { Injectable } from '@nestjs/common'

import * as fs from 'fs'
import * as yaml from 'js-yaml'

import { ConfigService } from '@nestjs/config'
import { ManifestYML } from '../../typescript/manifest-types'

@Injectable()
export class YamlService {
  yamlConfig: Object

  constructor(private configService: ConfigService) {}

  load(): ManifestYML {
    this.yamlConfig = this.configService.get('yaml')

    const fileContent: string = fs.readFileSync(
      `${process.cwd()}/manifest/backend.yml`,
      'utf8'
    )

    return yaml.load(fileContent) as ManifestYML
  }
}
