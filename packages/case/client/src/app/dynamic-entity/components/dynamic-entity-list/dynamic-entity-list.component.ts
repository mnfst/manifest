import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { of } from 'rxjs'
import { PropType } from '~shared/enums/prop-type.enum'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

import { SettingsService } from '../../../services/settings.service'
import { DynamicEntityService } from '../../dynamic-entity.service'
import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { EntityDescription } from '~shared/interfaces/entity-description.interface'

@Component({
  selector: 'app-dynamic-entity-list',
  templateUrl: './dynamic-entity-list.component.html',
  styleUrls: ['./dynamic-entity-list.component.scss']
})
export class DynamicEntityListComponent implements OnInit {
  items: any[] = []

  entities: EntityDescription[] = []
  entity: EntityDescription

  props: PropertyDescription[] = []

  PropType = PropType

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicEntityService: DynamicEntityService,
    private breadcrumbService: BreadcrumbService,
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
      this.activatedRoute.params.subscribe(async (params: Params) => {
        this.entity = this.entities.find(
          (entity) => entity.definition.slug === params['entityName']
        )

        if (!this.entity) {
          this.router.navigate(['/404'])
        }

        this.props = this.entity.props

        this.breadcrumbService.breadcrumbLinks.next([
          {
            label: this.entity.definition.namePlural
          }
        ])

        this.items = await this.dynamicEntityService.list(
          this.entity.definition.slug
        )
      })
    })
  }

  delete(id: number): void {
    this.dynamicEntityService
      .delete(this.entity.definition.slug, id)
      .then((res) => {
        this.items = this.items.filter((item: any) => item.id !== id)
      })
  }
}
