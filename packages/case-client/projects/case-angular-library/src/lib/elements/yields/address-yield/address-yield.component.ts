import { Component, Input, OnChanges } from '@angular/core'

import { Address } from '../../../interfaces/address.interface'

@Component({
  selector: 'case-address-yield',
  templateUrl: './address-yield.component.html',
  styleUrls: ['./address-yield.component.scss']
})
export class AddressYieldComponent implements OnChanges {
  @Input() stringAddress: string

  address: Address

  ngOnChanges(): void {
    if (this.stringAddress) {
      this.address = JSON.parse(this.stringAddress)
    }
  }
}
