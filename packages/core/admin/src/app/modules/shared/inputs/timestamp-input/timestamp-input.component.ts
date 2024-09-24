import { Component } from "@angular/core"
import { BaseInputComponent } from "../base-input/base-input-component"
import { NgClass } from "@angular/common"
@Component({
  selector: 'app-timestamp-input',
  standalone: true,
  template: `<label [for]="prop.name">{{ prop.name }}</label>
    <input
      class="input"
      [ngClass]="{ 'is-danger': isError }"
      type="datetime-local"
      [value]="value"
      (change)="onChange($event)"
      #input
    />`,
    imports:[BaseInputComponent,NgClass]
})
export class TimestampInputComponent extends BaseInputComponent {}
 