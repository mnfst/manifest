import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { RouterModule } from '@angular/router'
import { EntityManifest, RelationshipManifest } from '@repo/types'
import { ManifestService } from '../../services/manifest.service'

@Component({
  selector: 'app-relation-yield',
  standalone: true,
  imports: [RouterModule, CommonModule],
  template: ` <a
      [routerLink]="['/', 'dynamic', entityManifest.slug, item.id]"
      *ngIf="item && entityManifest"
    >
      <span>{{ item[entityManifest.mainProp] }}</span>
    </a>
    <span *ngIf="!item || !entityManifest">-</span>`,
  styleUrls: ['./relation-yield.component.scss']
})
export class RelationYieldComponent implements OnInit {
  entityManifest: EntityManifest

  constructor(private manifestService: ManifestService) {}

  @Input() item: any
  @Input() relationship: RelationshipManifest

  ngOnInit(): void {
    this.manifestService
      .getEntityManifest({
        className: this.relationship.entity
      })
      .then((entityManifest) => {
        this.entityManifest = entityManifest
      })
  }
}
