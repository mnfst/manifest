import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-rich-text-yield',
  standalone: true,
  imports: [],
  template: `
    <div class="wrapper">
      <div [innerHTML]="value"></div>
    </div>
  `,
  styleUrl: './rich-text-yield.component.scss'
})
export class RichTextYieldComponent {
  @Input() value: string
}
