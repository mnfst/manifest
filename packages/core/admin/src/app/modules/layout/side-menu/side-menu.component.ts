import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'
import { ADMIN_CLASS_NAME } from '../../../../constants'
import { ManifestService } from '../../shared/services/manifest.service'
import { Router, NavigationEnd } from '@angular/router'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent implements OnInit {
  collections: EntityManifest[]
  singles: EntityManifest[]

  isContentManager = false
  isDeveloperPanel = false

  constructor(
    private manifestService: ManifestService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.manifestService.getManifest().then((res: AppManifest) => {
      this.collections = Object.values(res.entities || {})
        .filter(
          (entityManifest: EntityManifest) =>
            entityManifest.className !== ADMIN_CLASS_NAME
        )
        .filter((entityManifest: EntityManifest) => !entityManifest.single)
        .filter((entityManifest: EntityManifest) => !entityManifest.nested)

      this.singles = Object.values(res.entities || {}).filter(
        (entityManifest: EntityManifest) => entityManifest.single
      )
    })

    // Set active menu item on first load
    this.setActiveMenuItem(this.router.url)

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects || event.url
        this.setActiveMenuItem(url)
      }
    })
  }

  goToFirstEntity() {
    const firstCollection: EntityManifest | undefined = this.collections.filter(
      (entityManifest: EntityManifest) =>
        entityManifest.className !== ADMIN_CLASS_NAME
    )[0]

    if (firstCollection) {
      const firstCollectionLink = firstCollection.single
        ? `/content/singles/${firstCollection.slug}`
        : `/content/collections/${firstCollection.slug}`

      this.router.navigateByUrl(firstCollectionLink)
    }
  }

  setActiveMenuItem(routerUrl: string) {
    this.isContentManager = routerUrl.startsWith('/content')
    this.isDeveloperPanel = routerUrl.startsWith('/dev')
  }
}
