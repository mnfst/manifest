import { Component } from '@angular/core'
import { OpenApiService } from '../../modules/shared/services/open-api.service'
import { SwaggerUiComponent } from 'src/app/shared/components/swagger-ui/swagger-ui.component'
import { NgIf } from '@angular/common'

@Component({
  selector: 'app-api-docs',
  standalone: true,
  imports: [SwaggerUiComponent, NgIf],
  templateUrl: './api-docs.component.html',
  styleUrls: ['./api-docs.component.scss']
})
export class ApiDocsComponent {
  apiDocs: any

  constructor(private openApiService: OpenApiService) {}

  async ngOnInit(): Promise<void> {
    this.apiDocs = await this.openApiService.getOpenApiDocs()
  }
}
