import { Component, OnInit, Renderer2 } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import {
  EntityManifest,
  Paginator,
  PropType,
  RelationshipManifest
} from '@mnfst/types'
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

      this.breadcrumbService.breadcrumbLinks.next([
        {
          label: this.entityManifest.namePlural,
          path: `/dynamic/${this.entityManifest.slug}`
        }
      ])

      this.loadingPaginator = true
      this.paginator = await this.crudService.list(this.entityManifest.slug, {
        filters: this.queryParams,
        relations: this.entityManifest.belongsTo.map(
          (relation: RelationshipManifest) => relation.name
        )
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

  delete(id: number): void {
    this.crudService.delete(this.entityManifest.slug, id).then((res) => {
      this.itemToDelete = null
      this.renderer.removeClass(document.querySelector('html'), 'is-clipped')
      this.flashMessageService.success(
        `The ${this.entityManifest.nameSingular} has been deleted.`
      )
      this.paginator.data = this.paginator.data.filter(
        (item: any) => item.id !== id
      )
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
