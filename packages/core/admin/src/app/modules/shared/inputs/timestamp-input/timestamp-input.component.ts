import { NgClass } from '@angular/common'
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core'
import { PropertyManifest } from '@mnfst/types'

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
  @Input() value: string
  @Input() isError: boolean

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
