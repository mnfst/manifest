import { Component, Inject, Input } from '@angular/core'
import { CaseConfig } from '../../../interfaces/case-config.interface'

@Component({
  selector: 'case-download-yield',
  templateUrl: './download-yield.component.html',
  styleUrls: ['./download-yield.component.scss']
})
export class DownloadYieldComponent {
  @Input() filePath: string
  storagePath: string = this.config.storagePath

  constructor(@Inject('CASE_CONFIG_TOKEN') private config: CaseConfig) {}
}
