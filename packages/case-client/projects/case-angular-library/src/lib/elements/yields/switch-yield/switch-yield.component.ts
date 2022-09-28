import { Component, Input } from '@angular/core'

@Component({
  selector: 'case-switch-yield',
  templateUrl: './switch-yield.component.html',
  styleUrls: ['./switch-yield.component.scss']
})
export class SwitchYieldComponent {
  @Input() value: any
  @Input() displayValue: string

  // Generate a unique id to make "label -> input" link.
  uniqueId: string = Math.floor(Math.random() * 10000).toString()
}
