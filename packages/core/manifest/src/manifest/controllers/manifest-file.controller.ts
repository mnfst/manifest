import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { YamlService } from '../services/yaml.service'
import { ConfigService } from '@nestjs/config'
import { IsDevAdminGuard } from '../../auth/guards/is-dev-admin.guard'
import { JsonSchemaGuard } from '../guards/json-schema.guard'

@Controller('manifest-file')
export class ManifestFileController {
  constructor(
    private readonly yamlService: YamlService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @UseGuards(IsDevAdminGuard)
  async getManifestFileContent(): Promise<{ content: string }> {
    return {
      content: await this.yamlService.loadFileContent(
        this.configService.get('paths').manifestFile
      )
    }
  }

  @Post()
  @UseGuards(IsDevAdminGuard, JsonSchemaGuard)
  async saveManifestFileContent(
    @Body() body: { content: string }
  ): Promise<void> {
    await this.yamlService.saveFileContent(
      this.configService.get('paths').manifestFile,
      body.content
    )
  }
}
