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
  selector: 'app-email-input',
  standalone: true,
  imports: [NgClass],
  template: `
    <label [for]="prop.propName">{{ prop.label }}</label>
    <input
      class="input"
      [ngClass]="{ 'is-danger': isError }"
      type="email"
      placeholder="Email"
      autocomplete="email"
      (change)="onChange($event)"
      #input
    />
  `,
  styleUrls: ['./email-input.component.scss']
})
export class EmailInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Input() value: string
  @Input() isError: boolean

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
