import { Component, Input } from '@angular/core'

@Component({
  standalone: true,
  selector: 'app-location-yield',
  template: `<a
    href="https://www.openstreetmap.org/?mlat={{ value.lat }}&mlon={{
      value.lng
    }}"
    target="_blank"
    >View on map</a
  > `,
  styleUrls: ['./location-yield.component.scss']
})
export class LocationYieldComponent {
  @Input() value: { lat: number; lng: number }
}
