import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { PropType, PropertyManifest } from '@mnfst/types'

import { YieldType } from '../../../typescript/enums/yield-type.enum'
import { BooleanYieldComponent } from './boolean-yield/boolean-yield.component'
import { CurrencyYieldComponent } from './currency-yield/currency-yield.component'
import { DateYieldComponent } from './date-yield/date-yield.component'
import { EmailYieldComponent } from './email-yield/email-yield.component'
import { LabelYieldComponent } from './label-yield/label-yield.component'
import { LinkYieldComponent } from './link-yield/link-yield.component'
import { LocationYieldComponent } from './location-yield/location-yield.component'
import { NumberYieldComponent } from './number-yield/number-yield.component'
import { ProgressBarYieldComponent } from './progress-bar-yield/progress-bar-yield.component'
import { TextYieldComponent } from './text-yield/text-yield.component'
import { TimestampYieldComponent } from './timestamp-yield/timestamp-yield.component'

@Component({
  selector: 'app-yield',
  standalone: true,
  imports: [
    CommonModule,
    BooleanYieldComponent,
    CurrencyYieldComponent,
    DateYieldComponent,
    TimestampYieldComponent,
    EmailYieldComponent,
    NumberYieldComponent,
    LinkYieldComponent,
    TextYieldComponent,
    LabelYieldComponent,
    ProgressBarYieldComponent,
    LocationYieldComponent
  ],
  template: `
    <app-text-yield
      *ngIf="prop.type === PropType.String || prop.type === PropType.Text"
      [value]="value"
      [compact]="compact"
    ></app-text-yield>
    <app-number-yield
      *ngIf="prop.type === PropType.Number"
      [value]="value"
    ></app-number-yield>
    <app-link-yield
      *ngIf="prop.type === PropType.Link"
      [value]="value"
      [compact]="compact"
    ></app-link-yield>
    <app-boolean-yield
      *ngIf="prop.type === PropType.Boolean"
      [value]="value"
    ></app-boolean-yield>
    <app-currency-yield
      *ngIf="prop.type === PropType.Money"
      [currency]="prop.options?.['currency']"
      [value]="value"
    ></app-currency-yield>
    <app-date-yield
      *ngIf="prop.type === PropType.Date"
      [value]="value"
    ></app-date-yield>
    <app-timestamp-yield
      *ngIf="prop.type === PropType.Timestamp"
      [value]="value"
    ></app-timestamp-yield>
    <app-email-yield
      *ngIf="prop.type === PropType.Email"
      [value]="value"
    ></app-email-yield>

    <app-label-yield
      *ngIf="prop.type === PropType.Choice && prop.options?.['sequential'] !== true"
      [values]="prop.options?.['values']"
      [value]="value"
    ></app-label-yield>

    <app-progress-bar-yield
      *ngIf="prop.type === PropType.Choice && prop.options?.['sequential'] === true"
      [values]="prop.options?.['values']"
      [value]="value"
    >
    </app-progress-bar-yield>

    <app-location-yield
      *ngIf="prop.type === PropType.Location"
      [value]="value"
    ></app-location-yield>
  `
})
export class YieldComponent {
  @Input() prop: PropertyManifest
  @Input() value: any
  @Input() compact: boolean = false

  PropType = PropType
  YieldType = YieldType
}
