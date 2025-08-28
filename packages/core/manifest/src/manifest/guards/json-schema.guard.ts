import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException
} from '@nestjs/common'
import { SchemaService } from '../services/schema.service'
import { YamlService } from '../services/yaml.service'
import { Manifest } from '../../../../types/src'

@Injectable()
export class JsonSchemaGuard implements CanActivate {
  constructor(
    private readonly schemaService: SchemaService,
    private readonly yamlService: YamlService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const manifestFileContent: string = context.switchToHttp().getRequest()
      .body['content']

    let parsedContent: Manifest
    let isValid: boolean

    try {
      parsedContent = await this.yamlService.load({ manifestFileContent })
    } catch (error) {
      throw new BadRequestException('Invalid YAML format in manifest content')
    }
    try {
      isValid = await this.schemaService.validate(parsedContent, true)
    } catch (error) {
      throw new BadRequestException(
        'Invalid JSON schema in manifest content: ' + error.message
      )
    }

    return isValid
  }
}
