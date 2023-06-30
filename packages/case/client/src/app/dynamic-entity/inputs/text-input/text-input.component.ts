import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  OnInit
} from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Component({
  selector: 'app-text-input',
  template: `<label [for]="prop.propName">{{ prop.label }}</label>
    <input
      class="input form-control"
      type="text"
      (change)="onChange($event)"
      #input
    />`,
  styleUrls: ['./text-input.component.scss']
})
export class TextInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Input() value: string

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
