import { NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-location-yield',
  template: `<a
      href="https://www.openstreetmap.org/?mlat={{ value.lat }}&mlon={{
        value.lng
      }}"
      target="_blank"
      *ngIf="value?.lat && value?.lng"
      >
      <i class="icon icon-map-pin mr-1"></i>
      <span>View on map</span></a
    >
    <span *ngIf="!value?.lat || !value?.lng">-</span> `,
  imports: [NgIf],
  styleUrls: ['./location-yield.component.scss']
})
export class LocationYieldComponent {
  @Input() value: { lat: number; lng: number }
}
