import { CommonModule } from '@angular/common'
import { Component, Input, OnInit } from '@angular/core'
import { TruncatePipe } from '../../pipes/truncate.pipe'
import { EnumOptions } from '~shared/interfaces/property-options/enum-options.interface'

@Component({
  selector: 'app-label-yield',
  standalone: true,
  imports: [CommonModule, TruncatePipe],
  template: `
    <span class="tag is-{{ color ? color : 'light' }}">{{ value }}</span>
  `,
  styleUrls: ['./label-yield.component.scss']
})
export class LabelYieldComponent implements OnInit {
  @Input() value: string
  @Input() options: EnumOptions
  color: string
  ngOnInit(): void {
    if (this.options?.color) {
      const colorObject = Object.assign({}, this.options.color)

      const colorKey = Object.keys(this.options.enum).find(
        (key) => this.options.enum[key] === this.value
      )

      this.color = colorObject[colorKey]
    }
  }
}
