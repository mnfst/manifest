import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { IsAdminGuard } from '../../auth/guards/is-admin.guard'
import { YamlService } from '../services/yaml.service'
import { ConfigService } from '@nestjs/config'

@Controller('manifest-file')
export class ManifestFileController {
  constructor(
    private readonly yamlService: YamlService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @UseGuards(IsAdminGuard)
  async getManifestFileContent(): Promise<{ content: string }> {
    return {
      content: await this.yamlService.loadFileContent(
        this.configService.get('paths').manifestFile
      )
    }
  }

  @Post()
  @UseGuards(IsAdminGuard)
  async saveManifestFileContent(
    @Body() body: { content: string }
  ): Promise<void> {
    await this.yamlService.saveFileContent(
      this.configService.get('paths').manifestFile,
      body.content
    )
  }
}
