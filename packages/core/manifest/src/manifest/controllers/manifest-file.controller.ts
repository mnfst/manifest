import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { YamlService } from '../services/yaml.service'
import { ConfigService } from '@nestjs/config'
import { AdminAccess } from '../../auth/decorators/admin-access.decorator'
import { AdminAccessGuard } from '../../auth/guards/admin-access.guard'

@Controller('manifest-file')
export class ManifestFileController {
  constructor(
    private readonly yamlService: YamlService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @AdminAccess('hasBackendBuilderAccess')
  @UseGuards(AdminAccessGuard)
  async getManifestFileContent(): Promise<{ content: string }> {
    return {
      content: await this.yamlService.loadFileContent(
        this.configService.get('paths').manifestFile
      )
    }
  }

  @Post()
  @AdminAccess('hasBackendBuilderAccess')
  @UseGuards(AdminAccessGuard)
  async saveManifestFileContent(
    @Body() body: { content: string }
  ): Promise<{ success: boolean }> {
    return this.yamlService.saveFileContent(
      this.configService.get('paths').manifestFile,
      body.content
    )
  }
}
