import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-number-input',
  template: ` <label [for]="prop.propName">{{ prop.label }}</label>
    <input
      class="input form-control"
      type="number"
      (change)="onChange($event)"
      step="1"
      #input
    />`,
  styleUrls: ['./number-input.component.scss']
})
export class NumberInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Input() value: number

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  @ViewChild('input', { static: true }) input: ElementRef

  ngOnInit(): void {
    if (this.value !== undefined) {
      this.input.nativeElement.value = this.value
    }
  }

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
