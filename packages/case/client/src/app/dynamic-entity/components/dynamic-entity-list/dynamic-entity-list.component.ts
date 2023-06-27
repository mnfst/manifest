import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { of } from 'rxjs'
import { PropType } from '~shared/enums/prop-type.enum'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

import { SettingsService } from '../../../services/settings.service'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-dynamic-entity-list',
  templateUrl: './dynamic-entity-list.component.html',
  styleUrls: ['./dynamic-entity-list.component.scss']
})
export class DynamicEntityListComponent implements OnInit {
  items: any[] = []

  entities: any[] = []
  entity: any

  props: PropertyDescription[] = []

  PropType = PropType

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicEntityService: DynamicEntityService,
    settingsService: SettingsService
  ) {
    settingsService.loadSettings().subscribe((res) => {
      this.entities = res.entities
    })
  }

  ngOnInit(): void {
    of(this.entities).subscribe((res) => {
      this.activatedRoute.params.subscribe((params: Params) => {
        this.entity = this.entities.find(
          (entity) => entity.definition.slug === params['entityName']
        )

        if (!this.entity) {
          this.router.navigate(['/404'])
        }

        this.props = this.entity.props

        this.dynamicEntityService
          .list(this.entity.definition.slug)
          .then((res: any[]) => {
            this.items = res
          })
      })
    })
  }

  delete(id: number): void {
    this.dynamicEntityService
      .delete(this.entity.definition.slug, id)
      .then((res) => {
        this.entity.data = this.entity.data.filter(
          (item: any) => item.id !== id
        )
      })
  }
}
