import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core'

import { NgClass } from '@angular/common'
import { PropertyManifest } from '@repo/types'

@Component({
  selector: 'app-url-input',
  standalone: true,
  imports: [NgClass],
  template: `<label [for]="prop.name">{{ prop.name }}</label>
    <input
      class="input form-control"
      [ngClass]="{ 'is-danger': isError }"
      type="url"
      placeholder="https://example.com"
      (change)="onChange($event)"
      #input
    />`,
  styleUrls: ['./url-input.component.scss']
})
export class UrlInputComponent implements OnInit {
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
