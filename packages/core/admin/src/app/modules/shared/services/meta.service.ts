import { Injectable } from '@angular/core'
import { ManifestService } from './manifest.service'
import { Title } from '@angular/platform-browser'

@Injectable({
  providedIn: 'root'
})
export class MetaService {
  appName: string = 'Manifest'

  constructor(
    manifestService: ManifestService,
    private title: Title
  ) {
    manifestService.getManifest().then((res) => {
      this.appName = res.name
    })
  }

  setTitle(title: string): void {
    this.title.setTitle(`${title} | ${this.appName}`)
  }
}
