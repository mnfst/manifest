import { Component, Input } from '@angular/core'
import { RelationOptions } from '~shared/interfaces/type-settings/relation-options.interface'
import { PropType } from '~shared/enums/prop-type.enum'

@Component({
  selector: 'app-yield',
  template: `
    <app-text-yield
      *ngIf="type === PropType.Text"
      [value]="value"
    ></app-text-yield>
    <app-number-yield
      *ngIf="type === PropType.Number"
      [value]="value"
    ></app-number-yield>
    <app-relation-yield
      *ngIf="type === PropType.Relation"
      [item]="value"
      [options]="options"
    ></app-relation-yield>
  `
})
export class YieldComponent {
  @Input() value: any
  @Input() type: PropType
  @Input() options?: RelationOptions

  PropType = PropType
}
