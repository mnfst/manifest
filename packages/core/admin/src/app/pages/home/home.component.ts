import { Component, OnInit } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'

import { ManifestService } from '../../modules/shared/services/manifest.service'
import { MetaService } from '../../modules/shared/services/meta.service'
import { ADMIN_CLASS_NAME } from '../../../constants'
import { AuthService } from '../../modules/auth/auth.service'
import { filter } from 'rxjs'
import { Admin } from '../../typescript/interfaces/admin.interface'
import { Router } from '@angular/router'
import { environment } from '../../../environments/environment'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  appManifest: AppManifest
  collections: EntityManifest[]
  singles: EntityManifest[]

  apiBaseUrl: string = environment.apiBaseUrl
  urlCopied: boolean = false

  hasContentManagerAccess = false
  hasBackendBuilderAccess = false
  hasApiDocsAccess = false

  constructor(
    private authService: AuthService,
    private manifestService: ManifestService,
    private metaService: MetaService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.metaService.setTitle('Admin panel')

    this.manifestService.getManifest().then((res: AppManifest) => {
      this.appManifest = res
      this.collections = Object.values(res.entities || {})
        .filter(
          (entityManifest: EntityManifest) =>
            entityManifest.className !== ADMIN_CLASS_NAME
        )
        .filter((entityManifest: EntityManifest) => !entityManifest.single)
        .filter((entityManifest: EntityManifest) => !entityManifest.nested)

      this.singles = Object.values(res.entities || {}).filter(
        (entity) => entity.single
      )
    })

    this.authService.currentUser$
      .pipe(filter((admin) => !!admin))
      .subscribe((admin: Admin) => {
        this.hasBackendBuilderAccess = admin.hasBackendBuilderAccess
        this.hasContentManagerAccess = admin.hasContentManagerAccess
        this.hasApiDocsAccess = admin.hasApiDocsAccess
      })
  }

  /**
   * Goes to the first entity of the list. Content manager does not have a homepage so we have to link to the first entity.
   */
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

  /**
   * Copies the given text to the clipboard and shows a confirmation message.
   */
  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.urlCopied = true

      // Reset to default state after 2 seconds
      setTimeout(() => {
        this.urlCopied = false
      }, 2000)
    })
  }
}
