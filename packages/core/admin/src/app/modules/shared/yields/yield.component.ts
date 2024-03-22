import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { PropType } from '@casejs/types'

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

@Component({
  selector: 'app-yield',
  standalone: true,
  imports: [
    CommonModule,
    BooleanYieldComponent,
    CurrencyYieldComponent,
    DateYieldComponent,
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
      *ngIf="type === PropType.String || type === PropType.Text"
      [value]="value"
      [compact]="compact"
    ></app-text-yield>
    <app-number-yield
      *ngIf="type === PropType.Number"
      [value]="value"
    ></app-number-yield>
    <app-link-yield
      *ngIf="type === PropType.Link"
      [value]="value"
      [compact]="compact"
    ></app-link-yield>

    <app-boolean-yield
      *ngIf="type === PropType.Boolean"
      [value]="value"
    ></app-boolean-yield>
    <app-currency-yield
      *ngIf="type === PropType.Money"
      [value]="value"
      [options]="options"
    ></app-currency-yield>
    <app-date-yield
      *ngIf="type === PropType.Date"
      [value]="value"
    ></app-date-yield>
    <app-email-yield
      *ngIf="type === PropType.Email"
      [value]="value"
    ></app-email-yield>

    <app-label-yield
      *ngIf="
        type === PropType.Choice &&
        (!options.display || options.display === 'label')
      "
      [value]="value"
      [options]="options"
    ></app-label-yield>

    <app-location-yield
      *ngIf="type === PropType.Location"
      [value]="value"
    ></app-location-yield>
  `
})
export class YieldComponent {
  @Input() value: any
  @Input() type: PropType
  @Input() options?: any
  @Input() compact: boolean = false

  PropType = PropType
  YieldType = YieldType
}
