import { Component, Renderer2 } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { BaseEntity, EntityManifest, RelationshipManifest } from '@repo/types'
import { ManifestService } from '../../../shared/services/manifest.service'
import { CrudService } from '../../services/crud.service'
import { MetaService } from '../../../shared/services/meta.service'
import { CapitalizeFirstLetterPipe } from '../../../shared/pipes/capitalize-first-letter.pipe'
import { FlashMessageService } from '../../../shared/services/flash-message.service'

@Component({
  selector: 'app-detail',
  templateUrl: './detail.component.html',
  styleUrls: ['./detail.component.scss']
})
export class DetailComponent {
  item: BaseEntity
  entityManifest: EntityManifest
  nestedEntityManifests: { [relationshipName: string]: EntityManifest } = {}

  singleMode: boolean
  showDeleteModal: boolean = false

  constructor(
    private crudService: CrudService,
    private manifestService: ManifestService,
    private activatedRoute: ActivatedRoute,
    private metaService: MetaService,
    private router: Router,
    private renderer: Renderer2,
    private flashMessageService: FlashMessageService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(async (params) => {
      // Get the entity manifest.
      this.entityManifest = await this.manifestService.getEntityManifest({
        slug: params['entitySlug']
      })

      // Get the nested entity manifests.
      if (this.entityManifest.relationships) {
        for (const relationship of this.entityManifest.relationships) {
          if (relationship.nested) {
            const nestedManifest = await this.manifestService.getEntityManifest(
              {
                className: relationship.entity
              }
            )
            this.nestedEntityManifests[relationship.name] = nestedManifest
          }
        }
      }

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
   * Get the multiple relations (one-to-many or many-to-many) of an item.
   *
   * @param item The item to get the relations from.
   * @param relationship The relationship manifest.
   *
   * @returns The related items as an array.
   */
  getMultipleRelations(
    item: BaseEntity,
    relationship: RelationshipManifest
  ): BaseEntity[] {
    return item[relationship.name] as BaseEntity[]
  }

  /**
   * Get the single relation (one-to-one) of an item.
   *
   * @param item The item to get the relation from.
   * @param relationship The relationship manifest.
   *
   * @returns The related item or null if not present.
   */
  getSingleRelation(
    item: BaseEntity,
    relationship: RelationshipManifest
  ): BaseEntity | null {
    return item[relationship.name] as BaseEntity | null
  }
  /**
   * Toggle the delete modal.
   */
  toggleDeleteModal(): void {
    if (this.showDeleteModal) {
      this.showDeleteModal = false
      this.renderer.removeClass(document.querySelector('html'), 'is-clipped')
    } else {
      this.showDeleteModal = true
      this.renderer.addClass(document.querySelector('html'), 'is-clipped')
    }
  }

  /**
   * Delete an item
   *
   * @param id The ID of the item to delete
   *
   * @returns void
   */
  delete(id: string): void {
    if (this.entityManifest.single) {
      throw new Error('Cannot delete a single item.')
    }
    this.crudService
      .delete(this.entityManifest.slug, id)
      .then(() => {
        this.flashMessageService.success(
          `The ${this.entityManifest.nameSingular} has been deleted.`
        )
        this.router.navigate(['/collections', this.entityManifest.slug])
      })
      .catch((err) => {
        this.flashMessageService.error(err.error.message)
      })
  }
}
