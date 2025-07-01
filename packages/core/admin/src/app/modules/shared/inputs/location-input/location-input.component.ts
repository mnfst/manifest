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
  selector: 'app-location-input',
  standalone: true,
  imports: [NgClass],
  template: `
    <label for="">{{ prop.name }}</label>
    <div class="columns is-mobile">
      <div class="column">
        <div class="field">
          <label for="lat-input">Latitude</label>
          <p class="control has-icons-left ">
            <span class="icon is-left">
              <i class="icon icon-map-pin"></i>
            </span>
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
          </p>
        </div>
      </div>
      <div class="column">
        <div class="field">
          <label for="lng-input">Longitude</label>
          <p class="control has-icons-left ">
            <span class="icon is-left">
              <i class="icon icon-map-pin"></i>
            </span>
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
          </p>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./location-input.component.scss']
})
export class LocationInputComponent implements OnInit {
  @Input() prop: PropertyManifest
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
