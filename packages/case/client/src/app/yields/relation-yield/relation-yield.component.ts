import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { RouterModule } from '@angular/router'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'
import { RelationOptions } from '~shared/interfaces/property-options/relation-options.interface'

import { DynamicEntityService } from '../../dynamic-entity/dynamic-entity.service'

@Component({
  selector: 'app-relation-yield',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: ` <a
      [routerLink]="['/', 'dynamic', entityMeta.definition.slug, item.id]"
      *ngIf="item"
    >
      <span>{{ item[entityMeta.definition.propIdentifier] }}</span>
    </a>

    <span *ngIf="!item">-</span>`,
  styleUrls: ['./relation-yield.component.scss']
})
export class RelationYieldComponent implements OnInit {
  entityMeta: EntityMeta

  constructor(private dynamicEntityService: DynamicEntityService) {}

  @Input() item: any
  @Input() options: RelationOptions

  ngOnInit(): void {
    this.dynamicEntityService
      .loadEntityMeta()
      .subscribe((res: EntityMeta[]) => {
        this.entityMeta = res.find(
          (entity: EntityMeta) => entity.className === this.options.entitySlug
        )
      })
  }
}
