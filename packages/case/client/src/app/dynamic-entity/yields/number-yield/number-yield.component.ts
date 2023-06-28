import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-number-yield',
  templateUrl: './number-yield.component.html',
  styleUrls: ['./number-yield.component.scss']
})
export class NumberYieldComponent {
  @Input() value: string
}
