import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'
import { ADMIN_CLASS_NAME } from '../../../../constants'
import { ManifestService } from '../../shared/services/manifest.service'
import { Router, NavigationEnd } from '@angular/router'
import { AuthService } from '../../auth/auth.service'
import { filter } from 'rxjs'
import { Admin } from '../../../typescript/interfaces/admin.interface'

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

  hasBackendBuilderAccess = false

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
    this.isDeveloperPanel = routerUrl.startsWith('/dev')
  }
}
