import { NgClass } from '@angular/common'
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
  selector: 'app-date-input',
  standalone: true,
  imports: [NgClass],
  template: `<label [for]="prop.propName">{{ prop.label }}</label>
    <input
      class="input"
      [ngClass]="{ 'is-danger': isError }"
      type="date"
      [value]="value ? value : today"
      (change)="onChange($event)"
      #input
    />`,
  styleUrls: ['./date-input.component.scss']
})
export class DateInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Input() value: string
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  @ViewChild('input', { static: true }) input: ElementRef

  today = Date.now()

  ngOnInit(): void {
    if (this.value !== undefined) {
      this.input.nativeElement.value = this.value
    }
  }

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
