import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { RouterModule } from '@angular/router'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'
import { RelationOptions } from '~shared/interfaces/property-options/relation-options.interface'

import { SettingsService } from '../../services/settings.service'

@Component({
  selector: 'app-relation-yield',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: ` <a
      [routerLink]="['/', 'dynamic', EntityMeta.definition.slug, item.id]"
      *ngIf="item"
    >
      <span>{{ item[EntityMeta.definition.propIdentifier] }}</span>
    </a>

    <span *ngIf="!item">-</span>`,
  styleUrls: ['./relation-yield.component.scss']
})
export class RelationYieldComponent implements OnInit {
  EntityMeta: EntityMeta

  constructor(private settingsService: SettingsService) {}

  @Input() item: any
  @Input() options: RelationOptions

  ngOnInit(): void {
    this.settingsService.loadSettings().subscribe((res) => {
      this.EntityMeta = res.entities.find(
        (entity: EntityMeta) => entity.className === this.options.entitySlug
      )
    })
  }
}
