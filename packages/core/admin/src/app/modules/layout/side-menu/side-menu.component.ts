import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AppManifest, EntityManifest } from '@repo/types'
import { ADMIN_CLASS_NAME } from '../../../../constants'
import { ManifestService } from '../../shared/services/manifest.service'
import { ModalService } from '../../shared/services/modal.service'
import { EntityManifestCreateEditComponent } from '../../manifest/components/entity-manifest-create-edit/entity-manifest-create-edit.component'

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent implements OnInit {
  collections: EntityManifest[]
  singles: EntityManifest[]

  constructor(
    private manifestService: ManifestService,
    private router: Router,
    private modalService: ModalService
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

  async addEntity({ single = false }: { single?: boolean } = {}) {
    this.modalService.open({
      component: EntityManifestCreateEditComponent,
      data: {
        authenticableEntities:
          await this.manifestService.getAuthenticableEntities(),
        single
      }
    })
  }
}
