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
  selector: 'app-textarea-input',
  standalone: true,
  imports: [NgClass],
  template: `<label [for]="prop.propName">{{ prop.label }}</label>
    <textarea
      class="textarea"
      [ngClass]="{ 'is-danger': isError }"
      (change)="onChange($event)"
      #input
      [name]="prop.propName"
    >
    </textarea> `,
  styleUrls: ['./textarea-input.component.scss']
})
export class TextareaInputComponent implements OnInit {
  @Input() prop: PropertyDescription
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
