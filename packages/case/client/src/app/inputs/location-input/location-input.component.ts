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
  selector: 'app-location-input',
  standalone: true,
  imports: [NgClass],
  template: `
    <label for="">{{ prop.label }}</label>
    <div class="columns">
      <div class="column">
        <label for="lat-input">Latitude</label>
        <input
          class="input form-control"
          [ngClass]="{ 'is-danger': isError }"
          type="number"
          (change)="onChange()"
          step="0.0001"
          min="-90"
          max="90"
          #latInput
        />
      </div>
      <div class="column">
        <label for="lng-input">Longitude</label>
        <input
          class="input form-control"
          [ngClass]="{ 'is-danger': isError }"
          type="number"
          (change)="onChange()"
          step="0.0001"
          min="-180"
          max="180"
          #lngInput
        />
      </div>
    </div>
  `,
  styleUrls: ['./location-input.component.scss']
})
export class LocationInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Input() value: { lat: number; lng: number }
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<{ lat: number; lng: number }> =
    new EventEmitter()

  @ViewChild('latInput', { static: true }) latInput: ElementRef
  @ViewChild('lngInput', { static: true }) lngInput: ElementRef

  ngOnInit(): void {
    if (this.value !== undefined) {
      this.latInput.nativeElement.value = this.value?.lat
      this.lngInput.nativeElement.value = this.value?.lng
    }
  }

  onChange() {
    this.valueChanged.emit({
      lat: this.latInput.nativeElement.value,
      lng: this.lngInput.nativeElement.value
    })
  }
}
