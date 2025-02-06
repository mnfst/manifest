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
  template: `<label [for]="prop.name">{{ prop.name }}</label>
    <input
      class="input"
      [ngClass]="{ 'is-danger': isError }"
      type="datetime-local"
      [value]="value"
      (change)="onChange($event)"
      #input
    />`
})
export class TimestampInputComponent {
  @Input() prop: PropertyManifest
  @Input() value: number
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  @ViewChild('input', { static: true }) input: ElementRef

  ngOnInit(): void {
    if (this.value !== undefined) {
      this.input.nativeElement.value = this.value
    }
  }

  onChange(event: any) {
    const valueDate = event.target.value ? new Date(event.target.value) : null
    this.valueChanged.emit(valueDate?.getTime())
  }
}
