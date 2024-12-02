import { NgIf } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-rich-text-yield',
  standalone: true,
  imports: [NgIf],
  template: `
    <div class="wrapper" *ngIf="value">
      <div class="content is-normal">
        <div [innerHTML]="value"></div>
      </div>
    </div>
    <span *ngIf="!value">-</span>
  `,
  styleUrl: './rich-text-yield.component.scss'
})
export class RichTextYieldComponent {
  @Input() value: string
}
