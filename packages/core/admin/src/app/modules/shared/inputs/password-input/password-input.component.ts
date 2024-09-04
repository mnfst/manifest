import { NgClass } from '@angular/common'
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core'
import { PropertyManifest } from '@repo/types'

@Component({
  selector: 'app-password-input',
  standalone: true,
  imports: [NgClass],
  template: `<label [for]="prop.name">{{ prop.name }}</label>
    <input
      class="input form-control"
      [ngClass]="{ 'is-danger': isError }"
      type="password"
      autocomplete="current-password"
      (change)="onChange($event)"
      #input
    />`,
  styleUrls: ['./password-input.component.scss']
})
export class PasswordInputComponent {
  @Input() prop: PropertyManifest
  @Input() value: string
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  @ViewChild('input', { static: true }) input: ElementRef

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
