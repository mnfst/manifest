import { Component, Input } from '@angular/core'

@Component({
  selector: 'case-text-yield',
  templateUrl: './text-yield.component.html',
  styleUrls: ['./text-yield.component.scss']
})
export class TextYieldComponent {
  @Input() text: string
  @Input() secondText: string
}
