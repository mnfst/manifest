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
import { BreadcrumbService } from '../../../shared/services/breadcrumb.service'
import { FlashMessageService } from '../../../shared/services/flash-message.service'
import { ManifestService } from '../../../shared/services/manifest.service'
import { CrudService } from '../../services/crud.service'

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class ListComponent implements OnInit {
  paginator: Paginator<{ [key: string]: any }>
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
    private breadcrumbService: BreadcrumbService,
    private flashMessageService: FlashMessageService,
    private renderer: Renderer2
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

      this.breadcrumbService.breadcrumbLinks.next([
        {
          label: this.entityManifest.namePlural,
          path: `/dynamic/${this.entityManifest.slug}`
        }
      ])

      this.loadingPaginator = true
      this.paginator = await this.crudService.list(this.entityManifest.slug, {
        filters: this.queryParams,
        relations: this.entityManifest.relationships
          ?.filter((r) => r.type !== 'one-to-many')
          .filter((r) => r.type !== 'many-to-many' || r.owningSide)
          .map((relation: RelationshipManifest) => relation.name)
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
  delete(id: number): void {
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
    this.router.navigate(['/dynamic', this.entityManifest.slug, id])
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
}
