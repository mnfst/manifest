import {
  Component,
  ElementRef,
  Input,
  ViewChild,
  ViewEncapsulation
} from '@angular/core'
import { SwaggerUIBundle } from 'swagger-ui-dist'

@Component({
  selector: 'app-swagger-ui',
  standalone: true,
  imports: [],
  templateUrl: './swagger-ui.component.html',
  styleUrls: ['./swagger-ui.css', './swagger-ui.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SwaggerUiComponent {
  @Input() apiDocs: any // TODO: OpenAPI Spec type (check in @nestjs/swagger)
  @ViewChild('apiDocsElement', { static: true }) apiDocsElement: ElementRef

  async ngAfterViewInit(): Promise<void> {
    SwaggerUIBundle({
      spec: this.apiDocs,
      domNode: this.apiDocsElement.nativeElement,
      presets: [SwaggerUIBundle['presets'].apis]
    })
  }
}
