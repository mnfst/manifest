import { NgClass } from '@angular/common'
import { Component } from '@angular/core'
import { BaseInputComponent } from '../base-input/base-input-component'

@Component({
  selector: 'app-textarea-input',
  standalone: true,
  imports: [NgClass,BaseInputComponent],
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
export class TextareaInputComponent extends BaseInputComponent {}
