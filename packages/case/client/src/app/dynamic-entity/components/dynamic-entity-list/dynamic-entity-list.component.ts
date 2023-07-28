import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { combineLatest } from 'rxjs'
import { PropType } from '~shared/enums/prop-type.enum'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'
import { Paginator } from '~shared/interfaces/paginator.interface'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-dynamic-entity-list',
  templateUrl: './dynamic-entity-list.component.html',
  styleUrls: ['./dynamic-entity-list.component.scss']
})
export class DynamicEntityListComponent implements OnInit {
  paginator: Paginator<any>
  loadingPaginator = true
  itemToDelete: any

  entityMeta: EntityMeta

  props: PropertyDescription[] = []
  filtrableProps: PropertyDescription[] = []

  queryParams: Params
  PropType = PropType

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicEntityService: DynamicEntityService,
    private breadcrumbService: BreadcrumbService,
    private flashMessageService: FlashMessageService
  ) {}

  ngOnInit(): void {
    this.dynamicEntityService
      .loadEntityMeta()
      .subscribe((res: EntityMeta[]) => {
        combineLatest([
          this.activatedRoute.queryParams,
          this.activatedRoute.params
        ]).subscribe(async ([queryParams, params]: Params[]) => {
          this.queryParams = queryParams

          this.entityMeta = res.find(
            (entityMeta: EntityMeta) =>
              entityMeta.definition.slug === params['entitySlug']
          )

          if (!this.entityMeta) {
            this.router.navigate(['/404'])
          }

          this.props = this.entityMeta.props.filter(
            (prop) => !prop.options?.isHiddenInList
          )
          this.filtrableProps = this.props.filter(
            (prop) => prop.options?.filter
          )

          this.breadcrumbService.breadcrumbLinks.next([
            {
              label: this.entityMeta.definition.namePlural
            }
          ])

          this.paginator = await this.dynamicEntityService.list(
            this.entityMeta.definition.slug,
            queryParams
          )
          this.loadingPaginator = false
        })
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
    this.dynamicEntityService
      .delete(this.entityMeta.definition.slug, id)
      .then((res) => {
        this.itemToDelete = null
        this.flashMessageService.success(
          `The ${this.entityMeta.definition.nameSingular} has been deleted.`
        )
        this.paginator.data = this.paginator.data.filter(
          (item: any) => item.id !== id
        )
      })
  }

  goToDetailPage(id: number): void {
    this.router.navigate(['/', 'dynamic', this.entityMeta.definition.slug, id])
  }
}
