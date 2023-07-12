import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { combineLatest, of } from 'rxjs'
import { PropType } from '~shared/enums/prop-type.enum'
import { EntityDescription } from '~shared/interfaces/entity-description.interface'
import { Paginator } from '~shared/interfaces/paginator.interface'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { SettingsService } from '../../../services/settings.service'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-dynamic-entity-list',
  templateUrl: './dynamic-entity-list.component.html',
  styleUrls: ['./dynamic-entity-list.component.scss']
})
export class DynamicEntityListComponent implements OnInit {
  paginator: Paginator<any>

  entities: EntityDescription[] = []
  entity: EntityDescription

  props: PropertyDescription[] = []
  filtrableProps: PropertyDescription[] = []

  queryParams: Params

  PropType = PropType

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicEntityService: DynamicEntityService,
    private breadcrumbService: BreadcrumbService,
    private flashMessageService: FlashMessageService,
    settingsService: SettingsService
  ) {
    settingsService
      .loadSettings()
      .subscribe((res: { entities: EntityDescription[] }) => {
        this.entities = res.entities
      })
  }

  ngOnInit(): void {
    of(this.entities).subscribe((res) => {
      combineLatest([
        this.activatedRoute.queryParams,
        this.activatedRoute.params
      ]).subscribe(async ([queryParams, params]: Params[]) => {
        this.queryParams = queryParams
        this.entity = this.entities.find(
          (entity) => entity.definition.slug === params['entitySlug']
        )

        // TODO: At first the this.entity is undefined, so we need to wait for it to be defined.
        if (!this.entity) {
          this.router.navigate(['/404'])
        }

        this.props = this.entity.props
        this.filtrableProps = this.props.filter((prop) => prop.filter)

        this.breadcrumbService.breadcrumbLinks.next([
          {
            label: this.entity.definition.namePlural
          }
        ])

        this.paginator = await this.dynamicEntityService.list(
          this.entity.definition.slug,
          queryParams
        )
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
      .delete(this.entity.definition.slug, id)
      .then((res) => {
        this.flashMessageService.success(
          `The ${this.entity.definition.nameSingular} has been deleted.`
        )
        this.paginator.data = this.paginator.data.filter(
          (item: any) => item.id !== id
        )
      })
  }
}
