import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-boolean-input',
  template: `
    <div class="control my-4">
      <label
        class="checkbox"
        for=""
        (click)="toggleCheck()"
        [ngClass]="{ 'is-checked': checked }"
        #input
        >{{ prop.label }}
        <span class="checkmark"></span>
      </label>
      <p class="help" *ngIf="helpText">{{ helpText }}</p>
    </div>
  `,
  styleUrls: ['./boolean-input.component.scss']
})
export class BooleanInputComponent implements OnChanges {
  @Input() prop: PropertyDescription
  @Output() valueChanged: EventEmitter<boolean> = new EventEmitter()

  @Input() value: boolean
  @Input() helpText?: string

  checked: boolean

  ngOnChanges(changes: SimpleChanges) {
    // Prevent value from being reset if showErrors changes.
    if (
      Object.keys(changes).length === 1 &&
      Object.keys(changes)[0] === 'showErrors'
    ) {
      return
    }

    this.checked = !!this.value
  }

  toggleCheck() {
    this.checked = !this.checked
    this.valueChanged.emit(this.checked)
  }
}
