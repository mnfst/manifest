import { Injectable } from '@nestjs/common'

import * as fs from 'fs'
import * as yaml from 'js-yaml'

import { ConfigService } from '@nestjs/config'

@Injectable()
export class YamlService {
  yamlConfig: Object

  constructor(private configService: ConfigService) {}

  load(): Object {
    this.yamlConfig = this.configService.get('yaml')

    const fileContent: string = fs.readFileSync(
      `${process.cwd()}/manifest/backend.yml`,
      'utf8'
    )

    const manifest: any = yaml.load(fileContent)

    return manifest
  }
}
