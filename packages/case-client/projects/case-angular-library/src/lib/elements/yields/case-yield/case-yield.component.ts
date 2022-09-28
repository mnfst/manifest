import { Component, Input } from '@angular/core'

import { YieldType } from '../../../enums/yield-type.enum'
import { Yield } from '../../../interfaces/yield.interface'

@Component({
  selector: 'case-yield',
  templateUrl: './case-yield.component.html',
  styleUrls: ['./case-yield.component.scss']
})
export class CaseYieldComponent {
  @Input() yield: Yield

  YieldType = YieldType
}
