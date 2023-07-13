import { CommonModule } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PropType } from '~shared/enums/prop-type.enum'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

import { BooleanInputComponent } from './boolean-input/boolean-input.component'
import { CurrencyInputComponent } from './currency-input/currency-input.component'
import { DateInputComponent } from './date-input/date-input.component'
import { EmailInputComponent } from './email-input/email-input.component'
import { FileUploadInputComponent } from './file-upload-input/file-upload-input.component'
import { MultiSelectInputComponent } from './multi-select-input/multi-select-input.component'
import { NumberInputComponent } from './number-input/number-input.component'
import { PasswordInputComponent } from './password-input/password-input.component'
import { SelectInputComponent } from './select-input/select-input.component'
import { TextAreaInputComponent } from './text-area-input/text-area-input.component'
import { TextInputComponent } from './text-input/text-input.component'
import { ImageUploadInputComponent } from './image-upload-input/image-upload-input.component'

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [
    CommonModule,
    BooleanInputComponent,
    CurrencyInputComponent,
    DateInputComponent,
    EmailInputComponent,
    MultiSelectInputComponent,
    NumberInputComponent,
    PasswordInputComponent,
    SelectInputComponent,
    TextAreaInputComponent,
    TextInputComponent,
    FileUploadInputComponent,
    ImageUploadInputComponent
  ],
  template: `
    <app-number-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Number"
    ></app-number-input>
    <app-text-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Text"
    ></app-text-input>
    <app-text-area-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.TextArea"
    ></app-text-area-input>
    <app-select-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Relation"
    >
    </app-select-input>
    <app-currency-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Currency"
    >
    </app-currency-input>
    <app-boolean-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Boolean"
    >
    </app-boolean-input>
    <app-email-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Email"
    >
    </app-email-input>
    <app-date-input
      [prop]="prop"
      [value]="value"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Date"
    >
    </app-date-input>
    <app-password-input
      [prop]="prop"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Password"
    >
    </app-password-input>
    <app-file-upload-input
      [prop]="prop"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.File"
    ></app-file-upload-input>
    <app-image-upload-input
      [prop]="prop"
      (valueChanged)="onChange($event)"
      *ngIf="prop.type === PropType.Image"
    ></app-image-upload-input>
  `
})
export class InputComponent {
  @Input() prop: PropertyDescription
  @Input() value: any
  @Output() valueChanged: EventEmitter<any> = new EventEmitter()

  PropType = PropType

  onChange(event: any) {
    this.valueChanged.emit(event)
  }
}
