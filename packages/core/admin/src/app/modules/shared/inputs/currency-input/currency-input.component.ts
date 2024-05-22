import { NgClass, getCurrencySymbol } from '@angular/common'
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild
} from '@angular/core'
import { PropertyManifest } from '@mnfst/types'

@Component({
  selector: 'app-currency-input',
  standalone: true,
  imports: [NgClass],
  template: ` <label [for]="prop.name">{{ prop.name }}</label>
    <p class="control has-icons-left">
      <span class="icon is-small is-left">
        <span class="is-family-sans-serif	">
          {{ symbol }}
        </span>
      </span>
      <input
        class="input"
        [ngClass]="{ 'is-danger': isError }"
        type="number"
        step="0.01"
        (change)="onChange($event)"
        #input
      />
    </p>`,
  styleUrls: ['./currency-input.component.scss']
})
export class CurrencyInputComponent implements OnInit {
  @Input() prop: PropertyManifest
  @Output() valueChanged: EventEmitter<number> = new EventEmitter()
  @Input() value: string
  @Input() currency: string | any
  @Input() isError: boolean

  @ViewChild('input', { static: true }) input: ElementRef

  symbol: string

  ngOnInit(): void {
    this.symbol = getCurrencySymbol(this.currency || 'USD', 'wide')

    if (this.value !== undefined) {
      this.input.nativeElement.value = this.value
    }
  }

  onChange(event: any) {
    this.valueChanged.emit(Number(event.target.value))
  }
}
