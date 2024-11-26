import { Component } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { BaseEntity, EntityManifest, RelationshipManifest } from '@repo/types'
import { BreadcrumbService } from '../../../shared/services/breadcrumb.service'
import { ManifestService } from '../../../shared/services/manifest.service'
import { CrudService } from '../../services/crud.service'

@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.scss']
})
export class DetailComponent {
  item: BaseEntity
  entityManifest: EntityManifest

  constructor(
    private crudService: CrudService,
    private manifestService: ManifestService,
    private activatedRoute: ActivatedRoute,
    private breadcrumbService: BreadcrumbService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(async (params) => {
      // Get the entity manifest.
      this.entityManifest = await this.manifestService.getEntityManifest({
        slug: params['entitySlug']
      })

      if (!this.entityManifest) {
        this.router.navigate(['/404'])
      }

      // Get the item.
      this.item = await this.crudService.show(
        this.entityManifest.slug,
        params['id'],
        {
          relations: this.entityManifest.relationships
            ?.filter((r) => r.type !== 'one-to-many')
            .filter((r) => r.type !== 'many-to-many' || r.owningSide)
            .map((relationship: RelationshipManifest) => relationship.name)
        }
      )

      // Set the breadcrumbs.
      this.breadcrumbService.breadcrumbLinks.next([
        {
          label: this.entityManifest.namePlural,
          path: `/collections/${this.entityManifest.slug}`
        },
        {
          label: this.item[
            this.entityManifest.mainProp as keyof BaseEntity
          ] as string
        }
      ])
    })
  }

  /**
   * Get the many-to-one relations of an item.
   *
   * @param item The item to get the relations from.
   * @param relationship The relationship manifest.
   *
   * @returns The related items as an array.
   */
  getManyToManyRelations(
    item: BaseEntity,
    relationship: RelationshipManifest
  ): BaseEntity[] {
    return item[relationship.name] as BaseEntity[]
  }
}
