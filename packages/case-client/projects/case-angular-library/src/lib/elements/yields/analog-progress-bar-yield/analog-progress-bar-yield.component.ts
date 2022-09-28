import {
  Component,
  OnInit,
  Input,
  ViewChild,
  ElementRef,
  Renderer2
} from '@angular/core'

@Component({
  selector: 'case-analog-progress-bar-yield',
  templateUrl: './analog-progress-bar-yield.component.html',
  styleUrls: ['./analog-progress-bar-yield.component.scss']
})
export class AnalogProgressBarYieldComponent implements OnInit {
  @Input() progressPercentage: number
  @Input() isLarge = false
  @Input() isColorOpposite = false

  @ViewChild('progress', { static: false }) progressEl: ElementRef

  constructor(private renderer: Renderer2) {}

  ngOnInit() {
    setTimeout(() => {
      // Set width.
      const percentage: number =
        this.progressPercentage > 1 ? 100 : this.progressPercentage * 100

      this.renderer.setStyle(
        this.progressEl.nativeElement,
        'width',
        `${percentage}%`
      )

      // Set background color.
      let className: string

      if (percentage < 50) {
        className = this.isColorOpposite ? 'is-warning' : 'is-danger'
      } else if (percentage === 100) {
        className = this.isColorOpposite ? 'is-danger' : 'is-success'
      } else {
        className = this.isColorOpposite ? 'is-danger' : 'is-warning'
      }

      this.renderer.addClass(this.progressEl.nativeElement, className)
    }, 0)
  }
}
