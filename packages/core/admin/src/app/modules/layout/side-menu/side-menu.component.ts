import { Component, OnInit } from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { AppManifest, EntityManifest } from '@repo/types'
import { filter } from 'rxjs'
import { ADMIN_CLASS_NAME } from '../../../../constants'
import { Admin } from '../../../typescript/interfaces/admin.interface'
import { AuthService } from '../../auth/auth.service'
import { ManifestService } from '../../shared/services/manifest.service'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent implements OnInit {
  collections: EntityManifest[]
  singles: EntityManifest[]

  isCollectionsOpen = false
  isSettingsOpen = false

  isContentManager = false
  isBackendBuilder = false
  isApiDocs = false

  hasContentManagerAccess = false
  hasBackendBuilderAccess = false
  hasApiDocsAccess = false

  constructor(
    private manifestService: ManifestService,
    private router: Router,
    private authService: AuthService
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

    this.authService.currentUser$
      .pipe(filter((admin) => !!admin))
      .subscribe((admin: Admin) => {
        this.hasBackendBuilderAccess = admin.hasBackendBuilderAccess
        this.hasContentManagerAccess = admin.hasContentManagerAccess
        this.hasApiDocsAccess = admin.hasApiDocsAccess
      })
  }

  goToFirstEntity() {
    let firstEntity: EntityManifest | undefined = this.collections.filter(
      (entityManifest: EntityManifest) =>
        entityManifest.className !== ADMIN_CLASS_NAME
    )[0]

    if (!firstEntity) {
      firstEntity = this.singles[0]
    }

    if (firstEntity) {
      const firstEntityLink = firstEntity.single
        ? `/content/singles/${firstEntity.slug}`
        : `/content/collections/${firstEntity.slug}`

      this.router.navigateByUrl(firstEntityLink)
    }
  }

  setActiveMenuItem(routerUrl: string) {
    this.isContentManager = routerUrl.startsWith('/content')
    this.isBackendBuilder = routerUrl.startsWith('/builder')
    this.isApiDocs = routerUrl.startsWith('/api-docs')
  }
}
