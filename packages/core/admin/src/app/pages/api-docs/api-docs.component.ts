import {
  Component,
  ElementRef,
  ViewChild,
  ViewEncapsulation
} from '@angular/core'
import { OpenApiService } from '../../modules/shared/services/open-api.service'
import { SwaggerUIBundle } from 'swagger-ui-dist'

@Component({
  selector: 'app-api-docs',
  standalone: true,
  imports: [],
  templateUrl: './api-docs.component.html',
  styleUrls: ['./swagger-ui.css', './api-docs.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ApiDocsComponent {
  @ViewChild('apiDocs', { static: true }) apiDocs: ElementRef

  constructor(private openApiService: OpenApiService) {}

  async ngAfterViewInit(): Promise<void> {
    const apiDocs = await this.openApiService.getOpenApiDocs()

    SwaggerUIBundle({
      spec: apiDocs,
      domNode: this.apiDocs.nativeElement,
      presets: [SwaggerUIBundle['presets'].apis]
    })

    // Call API to fetch OpenAPI documentation.
    // Render the documentation using Swagger UI https://medium.com/medialesson/show-swagger-document-in-an-angular-app-504bba306222
  }
}
