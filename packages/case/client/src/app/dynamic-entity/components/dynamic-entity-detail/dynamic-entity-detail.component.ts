import { Component } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'

import { EntityDescription } from '../../../../../../shared/interfaces/entity-description.interface'
import { SettingsService } from '../../../services/settings.service'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-dynamic-entity-detail',
  templateUrl: './dynamic-entity-detail.component.html',
  styleUrls: ['./dynamic-entity-detail.component.scss']
})
export class DynamicEntityDetailComponent {
  item: any
  entityDescription: EntityDescription

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicEntityService: DynamicEntityService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.params.subscribe((params) => {
      this.settingsService.loadSettings().subscribe((res) => {
        this.entityDescription = res.entities.find(
          (entity: EntityDescription) =>
            entity.definition.slug === params['entityName']
        )

        this.dynamicEntityService
          .show(this.entityDescription.definition.slug, params['id'])
          .then((res) => {
            this.item = res
          })
      })
    })
  }
}
