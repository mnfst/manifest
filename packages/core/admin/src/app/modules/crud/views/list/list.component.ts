import { Component, OnInit, Renderer2 } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import {
  EntityManifest,
  Paginator,
  PropType,
  PropertyManifest,
  RelationshipManifest
} from '@repo/types'
import { combineLatest } from 'rxjs'

import { FlashMessageService } from '../../../shared/services/flash-message.service'
import { ManifestService } from '../../../shared/services/manifest.service'
import { CrudService } from '../../services/crud.service'
import { MetaService } from '../../../shared/services/meta.service'
import { CapitalizeFirstLetterPipe } from '../../../shared/pipes/capitalize-first-letter.pipe'
import { ModalService } from '../../../shared/services/modal.service'
import { EntityManifestCreateEditComponent } from '../../../manifest/components/entity-manifest-create-edit/entity-manifest-create-edit.component'

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class ListComponent implements OnInit {
  paginator: Paginator<{ [key: string]: any }> | null = null
  loadingPaginator: boolean
  itemToDelete: { [key: string]: any }

  entityManifest: EntityManifest
  properties: PropertyManifest[]

  queryParams: Params
  PropType = PropType

  constructor(
    private crudService: CrudService,
    private manifestService: ManifestService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private metaService: MetaService,
    private flashMessageService: FlashMessageService,
    private renderer: Renderer2,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.activatedRoute.queryParams,
      this.activatedRoute.params
    ]).subscribe(async ([queryParams, params]: Params[]) => {
      delete this.paginator
      this.queryParams = queryParams

      this.entityManifest = await this.manifestService.getEntityManifest({
        slug: params['entitySlug']
      })

      if (!this.entityManifest) {
        this.router.navigate(['/404'])
        return
      }

      // Do not display columns for password and rich text fields as they are not suitable for list view.
      this.properties = this.entityManifest.properties.filter(
        (prop) =>
          prop.type !== PropType.Password && prop.type !== PropType.RichText
      )

      this.metaService.setTitle(
        new CapitalizeFirstLetterPipe().transform(
          this.entityManifest.namePlural
        )
      )

      this.loadingPaginator = true
      this.paginator = await this.crudService
        .list(this.entityManifest.slug, {
          filters: this.queryParams,
          relations: this.entityManifest.relationships
            ?.filter((r) => r.type !== 'one-to-many')
            .filter((r) => r.type !== 'many-to-many' || r.owningSide)
            .map((relation: RelationshipManifest) => relation.name)
        })
        .catch(() => {
          this.loadingPaginator = false
          return null
        })
      this.loadingPaginator = false
    })
  }

  filter(propName: string, value: string | number): void {
    const queryParams: Params = { [propName]: value }

    if (propName !== 'page') {
      queryParams['page'] = 1
    }

    this.router.navigate(['.'], {
      relativeTo: this.activatedRoute,
      queryParams,
      queryParamsHandling: 'merge'
    })
  }

  /**
   * Delete an item
   *
   * @param id The ID of the item to delete
   *
   * @returns void
   */
  delete(id: string): void {
    this.crudService
      .delete(this.entityManifest.slug, id)
      .then(() => {
        this.itemToDelete = null
        this.renderer.removeClass(document.querySelector('html'), 'is-clipped')
        this.flashMessageService.success(
          `The ${this.entityManifest.nameSingular} has been deleted.`
        )
        this.paginator.data = this.paginator.data.filter(
          (item: any) => item.id !== id
        )
      })
      .catch((err) => {
        this.flashMessageService.error(err.error.message)
      })
  }

  goToDetailPage(id: number): void {
    this.router.navigate(['/content/collections', this.entityManifest.slug, id])
  }

  toggleDeleteModal(itemToDelete?: any): void {
    if (this.itemToDelete) {
      this.itemToDelete = null
      this.renderer.removeClass(document.querySelector('html'), 'is-clipped')
    } else {
      this.itemToDelete = itemToDelete
      this.renderer.addClass(document.querySelector('html'), 'is-clipped')
    }
  }

  /**
   * Open the edit entity manifest modal to edit the current entity manifest.
   */
  editEntity() {
    this.modalService.open({
      component: EntityManifestCreateEditComponent,
      data: {
        entityManifest: this.entityManifest
      }
    })
  }
}
