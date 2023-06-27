import { Component, EventEmitter, Input, Output } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-number-input',
  template: ` <input
    [id]="field.propName"
    [placeholder]="placeholder ? placeholder : ''"
    class="input form-control"
    type="number"
    (change)="onChange($event)"
    step="1"
  />`,
  styleUrls: ['./number-input.component.scss']
})
export class NumberInputComponent {
  @Input() field: PropertyDescription
  @Input() initialValue: { value: string }
  @Input() placeholder: string
  @Output() inputValueChanged: EventEmitter<number> = new EventEmitter()

  form: FormGroup

  constructor(private formBuilder: FormBuilder) {}

  ngOnChanges() {
    this.form = this.formBuilder.group({
      number: [this.initialValue ? this.initialValue.value : '']
    })
  }

  onChange(event: any) {
    const value: number = event.target.value
    this.form.controls['number'].setValue(value)
    this.inputValueChanged.emit(value)
  }
}
