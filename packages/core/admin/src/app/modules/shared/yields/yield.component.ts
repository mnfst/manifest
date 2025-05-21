import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'
import { PropType, PropertyManifest } from '@repo/types'

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
import { ImageYieldComponent } from './image-yield/image-yield.component'
import { RichTextYieldComponent } from './rich-text-yield/rich-text-yield.component'

@Component({
    selector: 'app-yield',
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
        LocationYieldComponent,
        ImageYieldComponent,
        RichTextYieldComponent
    ],
    template: `
    <app-text-yield
      *ngIf="prop.type === PropType.String || prop.type === PropType.Text"
      [value]="value"
      [compact]="compact"
    ></app-text-yield>
    <app-rich-text-yield
      *ngIf="prop.type === PropType.RichText"
      [value]="value"
    >
    </app-rich-text-yield>
    <app-number-yield
      *ngIf="prop.type === PropType.Number"
      [value]="value"
    ></app-number-yield>
    <app-link-yield
      *ngIf="prop.type === PropType.Link || prop.type === PropType.File"
      [value]="value"
      [isDownload]="prop.type === PropType.File"
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
      *ngIf="
        prop.type === PropType.Choice && prop.options?.['sequential'] !== true
      "
      [values]="prop.options?.['values']"
      [value]="value"
    ></app-label-yield>

    <app-progress-bar-yield
      *ngIf="
        prop.type === PropType.Choice && prop.options?.['sequential'] === true
      "
      [values]="prop.options?.['values']"
      [value]="value"
    >
    </app-progress-bar-yield>

    <app-location-yield
      *ngIf="prop.type === PropType.Location"
      [value]="value"
    ></app-location-yield>

    <app-image-yield
      *ngIf="prop.type === PropType.Image"
      [value]="value"
      [sizes]="prop.options?.['sizes']"
    ></app-image-yield>
  `
})
export class YieldComponent {
  @Input() prop: PropertyManifest
  @Input() value: any
  @Input() compact: boolean = false

  PropType = PropType
  YieldType = YieldType
}
