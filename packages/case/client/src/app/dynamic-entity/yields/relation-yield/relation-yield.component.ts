import { Component, Input, OnInit } from '@angular/core'
import { EntityDescription } from '~shared/interfaces/entity-description.interface'
import { RelationOptions } from '~shared/interfaces/type-settings/relation-options.interface'

import { SettingsService } from '../../../services/settings.service'

@Component({
  selector: 'app-relation-yield',
  template: ` <a
      [routerLink]="[
        '/',
        'dynamic',
        entityDescription.definition.slug,
        item.id
      ]"
      *ngIf="item"
    >
      <span>{{ item[entityDescription.definition.propIdentifier] }}</span>
    </a>

    <span *ngIf="!item">-</span>`,
  styleUrls: ['./relation-yield.component.scss']
})
export class RelationYieldComponent implements OnInit {
  entityDescription: EntityDescription

  constructor(private settingsService: SettingsService) {}

  @Input() item: any
  @Input() options: RelationOptions

  ngOnInit(): void {
    this.settingsService.loadSettings().subscribe((res) => {
      this.entityDescription = res.entities.find(
        (entity: EntityDescription) =>
          entity.className === this.options.entityName
      )
    })
  }
}
