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
  selector: 'app-timestamp-input',
  standalone: true,
  imports: [NgClass],
  template: `<label [for]="prop.label">{{ prop.label }}</label>
    <input
      class="input"
      [ngClass]="{ 'is-danger': isError }"
      type="datetime-local"
      (change)="onChange($event)"
      #input
    />`
})
export class TimestampInputComponent {
  @Input() prop: PropertyManifest
  @Input() value: string
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<Date> = new EventEmitter()

  @ViewChild('input', { static: true }) input: ElementRef

  ngOnInit(): void {
    if (this.value !== null) {
      this.input.nativeElement.value = new Date(this.value)
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19)
    } else {
      this.input.nativeElement.value = ''
    }
  }

  onChange(event: any) {
    this.valueChanged.emit(new Date(event.target.value))
  }
}
