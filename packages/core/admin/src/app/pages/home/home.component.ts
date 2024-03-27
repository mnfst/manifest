import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@casejs/types'
import { BreadcrumbService } from '../../modules/shared/services/breadcrumb.service'
import { ManifestService } from '../../modules/shared/services/manifest.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  appManifest: AppManifest
  entityManifests: EntityManifest[]

  constructor(
    private breadcrumbService: BreadcrumbService,
    private manifestService: ManifestService
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.breadcrumbLinks.next([])
    this.manifestService.getManifest().then((res: AppManifest) => {
      this.appManifest = res
      this.entityManifests = Object.values(res.entities || {})
    })
  }
}
