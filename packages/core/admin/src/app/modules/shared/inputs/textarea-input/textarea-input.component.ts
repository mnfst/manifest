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
import { PropertyManifest } from '@repo/types'

@Component({
  selector: 'app-textarea-input',
  standalone: true,
  imports: [NgClass],
  template: `<label [for]="prop.name">{{ prop.name }}</label>
    <textarea
      class="textarea"
      [ngClass]="{ 'is-danger': isError }"
      (change)="onChange($event)"
      #input
      [name]="prop.name"
    >
    </textarea> `,
  styleUrls: ['./textarea-input.component.scss']
})
export class TextareaInputComponent implements OnInit {
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
