import { CommonModule } from '@angular/common'
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core'
import { PropType, PropertyManifest, RelationshipManifest } from '@mnfst/types'

import { BooleanInputComponent } from './boolean-input/boolean-input.component'
import { CurrencyInputComponent } from './currency-input/currency-input.component'
import { DateInputComponent } from './date-input/date-input.component'
import { EmailInputComponent } from './email-input/email-input.component'
import { LocationInputComponent } from './location-input/location-input.component'
import { MultiSelectInputComponent } from './multi-select-input/multi-select-input.component'
import { NumberInputComponent } from './number-input/number-input.component'
import { PasswordInputComponent } from './password-input/password-input.component'
import { SelectInputComponent } from './select-input/select-input.component'
import { TextInputComponent } from './text-input/text-input.component'
import { TextareaInputComponent } from './textarea-input/textarea-input.component'
import { UrlInputComponent } from './url-input/url-input.component'
import { TimestampInputComponent } from './timestamp-input/timestamp-input.component'

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [
    CommonModule,
    BooleanInputComponent,
    CurrencyInputComponent,
    DateInputComponent,
    TimestampInputComponent,
    EmailInputComponent,
    UrlInputComponent,
    MultiSelectInputComponent,
    NumberInputComponent,
    PasswordInputComponent,
    SelectInputComponent,
    TextareaInputComponent,
    TextInputComponent,
    LocationInputComponent
  ],
  template: `
    <app-text-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.String"
    ></app-text-input>
    <app-number-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Number"
    ></app-number-input>
    <app-url-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Link"
    ></app-url-input>
    <app-textarea-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Text"
    ></app-textarea-input>
    <app-select-input
      [prop]="prop"
      [relationship]="relationship"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Choice || relationship"
    >
    </app-select-input>
    <app-currency-input
      [prop]="prop"
      [value]="value"
      [currency]="prop?.options?.['currency']"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Money"
    >
    </app-currency-input>
    <app-boolean-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Boolean"
    >
    </app-boolean-input>
    <app-email-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Email"
    >
    </app-email-input>
    <app-date-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Date"
    >
    </app-date-input>
    <app-timestamp-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Timestamp"
    >
    </app-timestamp-input>
    <app-password-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Password"
    >
    </app-password-input>
    <app-location-input
      [prop]="prop"
      [value]="value"
      [isError]="isError"
      (valueChanged)="onChange($event)"
      *ngIf="prop?.type === PropType.Location"
    ></app-location-input>

    <!-- Error messages -->
    <ul *ngIf="errors?.length">
      <li *ngFor="let error of errors" class="has-text-danger">{{ error }}</li>
    </ul>
  `
})
export class InputComponent implements OnChanges {
  @Input() prop: PropertyManifest
  @Input() relationship: RelationshipManifest
  @Input() value: any
  @Input() errors: string[]
  @Output() valueChanged: EventEmitter<any> = new EventEmitter()

  isError: boolean
  PropType = PropType

  onChange(event: any) {
    this.valueChanged.emit(event)
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.isError = !!this.errors?.length
  }
}
