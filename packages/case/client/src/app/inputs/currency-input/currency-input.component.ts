import { getCurrencySymbol } from '@angular/common'
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
  selector: 'app-currency-input',
  standalone: true,
  template: ` <label [for]="prop.propName">{{ prop.label }}</label>
    <p class="control has-icons-left">
      <span class="icon is-small is-left">
        <span class="is-family-sans-serif	">
          {{ symbol }}
        </span>
      </span>
      <input
        class="input"
        type="number"
        step="0.01"
        (change)="onChange($event)"
        #input
      />
    </p>`,
  styleUrls: ['./currency-input.component.scss']
})
export class CurrencyInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Output() valueChanged: EventEmitter<number> = new EventEmitter()
  @Input() value: string

  @ViewChild('input', { static: true }) input: ElementRef

  symbol: string

  ngOnInit(): void {
    this.symbol = getCurrencySymbol(
      (this.prop.options as any).currency || 'USD',
      'wide'
    )

    if (this.value !== undefined) {
      this.input.nativeElement.value = this.value
    }
  }

  onChange(event: any) {
    this.valueChanged.emit(event.target.value)
  }
}
