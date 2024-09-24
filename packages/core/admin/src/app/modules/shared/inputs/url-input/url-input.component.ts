import { Component } from '@angular/core';
import { BaseInputComponent } from '../base-input/base-input-component';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-url-input',
  standalone: true,
  template: `<label [for]="prop.name">{{ prop.name }}</label>
    <input
      class="input form-control"
      [ngClass]="{ 'is-danger': isError }"
      type="url"
      placeholder="https://example.com"
      (change)="onChange($event)"
      #input
    />`,
  imports: [BaseInputComponent,NgClass],
  styleUrls: ['./url-input.component.scss']
})
export class UrlInputComponent extends BaseInputComponent {}