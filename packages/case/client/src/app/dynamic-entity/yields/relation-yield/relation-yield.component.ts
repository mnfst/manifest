import { Component, Input } from '@angular/core'
import { SettingsService } from '../../../shared/services/settings.service'

import { EntityDescription } from '~shared/interfaces/entity-description.interface'

@Component({
  selector: 'app-relation-yield',
  templateUrl: './relation-yield.component.html',
  styleUrls: ['./relation-yield.component.scss']
})
export class RelationYieldComponent {
  entityDescription: EntityDescription

  constructor(settingsService: SettingsService) {
    settingsService.loadSettings().subscribe((res) => {
      this.entityDescription = res.entities.find(
        (entity: EntityDescription) => entity.className === this.relatedEntity
      )

      console.log(this.entityDescription, this.relatedEntity)
    })
  }

  @Input() entity: any
  @Input() relatedEntity: string
}
