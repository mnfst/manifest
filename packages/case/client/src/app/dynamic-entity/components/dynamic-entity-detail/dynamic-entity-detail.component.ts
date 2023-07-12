import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'

import { EntityDescription } from '~shared/interfaces/entity-description.interface'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'
import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { SettingsService } from '../../../services/settings.service'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-dynamic-entity-detail',
  templateUrl: './dynamic-entity-detail.component.html',
  styleUrls: ['./dynamic-entity-detail.component.scss']
})
export class DynamicEntityDetailComponent {
  item: any
  props: PropertyDescription[]
  entityDescription: EntityDescription

  constructor(
    private activatedRoute: ActivatedRoute,
    private dynamicEntityService: DynamicEntityService,
    private settingsService: SettingsService,
    private breadcrumbService: BreadcrumbService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.params.subscribe((params) => {
      this.settingsService.loadSettings().subscribe((res) => {
        this.entityDescription = res.entities.find(
          (entity: EntityDescription) =>
            entity.definition.slug === params['entitySlug']
        )

        this.props = this.entityDescription.props.filter(
          (prop) => !prop.options?.isHiddenInDetail
        )

        this.dynamicEntityService
          .show(this.entityDescription.definition.slug, params['id'])
          .then((res) => {
            this.item = res

            this.breadcrumbService.breadcrumbLinks.next([
              {
                label: this.entityDescription.definition.namePlural,
                path: `/dynamic/${this.entityDescription.definition.slug}`
              },
              {
                label:
                  this.item[this.entityDescription.definition.propIdentifier]
              }
            ])
          })
      })
    })
  }
}
