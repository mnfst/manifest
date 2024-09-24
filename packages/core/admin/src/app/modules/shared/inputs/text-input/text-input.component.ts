import { NgClass } from '@angular/common'
import { Component } from '@angular/core'
import { BaseInputComponent } from '../base-input/base-input-component'

@Component({
  selector: 'app-text-input',
  standalone: true,
  imports: [NgClass,BaseInputComponent],
  template: `<label [for]="prop.name">{{ prop.name }}</label>
    <input
      class="input form-control"
      [ngClass]="{ 'is-danger': isError }"
      type="text"
      (change)="onChange($event)"
      #input
    />`,
  styleUrls: ['./text-input.component.scss']
})
export class TextInputComponent extends BaseInputComponent {}
