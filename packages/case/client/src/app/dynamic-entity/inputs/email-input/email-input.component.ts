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
  selector: 'app-email-input',
  template: `
    <label [for]="prop.propName">{{ prop.label }}</label>
    <div class="control">
      <input
        class="input"
        type="email"
        placeholder="Email"
        (change)="onChange($event)"
        #input
      />
    </div>
  `,
  styleUrls: ['./email-input.component.scss']
})
export class EmailInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Input() value: string

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

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
