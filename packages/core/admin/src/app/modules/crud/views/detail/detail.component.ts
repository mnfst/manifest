import { Component } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { BaseEntity, EntityManifest, RelationshipManifest } from '@repo/types'
import { ManifestService } from '../../../shared/services/manifest.service'
import { CrudService } from '../../services/crud.service'
import { MetaService } from '../../../shared/services/meta.service'
import { CapitalizeFirstLetterPipe } from '../../../shared/pipes/capitalize-first-letter.pipe'

@Component({
    selector: 'app-detail',
    templateUrl: './detail.component.html',
    styleUrls: ['./detail.component.scss'],
    standalone: false
})
export class DetailComponent {
  item: BaseEntity
  entityManifest: EntityManifest

  singleMode: boolean

  constructor(
    private crudService: CrudService,
    private manifestService: ManifestService,
    private activatedRoute: ActivatedRoute,
    private metaService: MetaService,
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

      this.singleMode = this.activatedRoute.snapshot.data['mode'] === 'single'

      // Get the item.
      try {
        if (this.singleMode) {
          this.item = await this.crudService.showSingle(
            this.entityManifest.slug
          )
        } else {
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
        }
      } catch (err) {
        this.router.navigate(['/404'])
      }

      this.metaService.setTitle(
        new CapitalizeFirstLetterPipe().transform(
          this.entityManifest.nameSingular
        )
      )
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
