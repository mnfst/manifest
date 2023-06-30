import { Component, Input } from '@angular/core'
import { RelationOptions } from '~shared/interfaces/type-settings/relation-options.interface'
import { PropType } from '~shared/enums/prop-type.enum'

@Component({
  selector: 'app-yield',
  template: `
    <app-text-yield
      *ngIf="type === PropType.Text || type === PropType.TextArea"
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
    <app-boolean-yield
      *ngIf="type === PropType.Boolean"
      [value]="value"
    ></app-boolean-yield>
    <app-currency-yield
      *ngIf="type === PropType.Currency"
      [value]="value"
    ></app-currency-yield>
    <app-date-yield
      *ngIf="type === PropType.Date"
      [value]="value"
    ></app-date-yield>
    <app-email-yield
      *ngIf="type === PropType.Email"
      [value]="value"
    ></app-email-yield>
  `
})
export class YieldComponent {
  @Input() value: any
  @Input() type: PropType
  @Input() options?: RelationOptions

  PropType = PropType
}
