import {
  Component,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnInit,
  Output
} from '@angular/core'
import { ValidatorFn, Validators } from '@angular/forms'
import { Address as GooglePlaceAddress } from 'ngx-google-places-autocomplete/objects/address'

import { Address } from '../../../interfaces/address.interface'
import { CaseConfig } from '../../../interfaces/case-config.interface'
import { CaseInput } from '../../../interfaces/case-input.interface'
import { FlashMessageService } from '../../../services/flash-message.service'
import { ScriptService } from '../../../services/script.service'

@Component({
  selector: 'case-address-input',
  templateUrl: './address-input.component.html',
  styleUrls: ['./address-input.component.scss']
})
export class AddressInputComponent implements CaseInput, OnChanges, OnInit {
  @Input() label: string
  @Input() placeholder: string
  @Input() helpText: string
  @Input() initialValue: string
  @Input() showErrors = false
  @Input() validators: ValidatorFn[] = []
  @Input() uniqueId: string

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  address: Address
  required: boolean
  scriptLoaded = false

  constructor(
    private scriptService: ScriptService,
    private flashMessageService: FlashMessageService,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  ngOnInit(): void {
    if (!this.config.googlePlacesAPIKey) {
      return this.flashMessageService.error(
        'A Google Places API Key is needed to make the Address Input work.'
      )
    }

    this.scriptService
      .load(
        `https://maps.googleapis.com/maps/api/js?key=${this.config.googlePlacesAPIKey}&libraries=places&language=en`
      )
      .then((data) => {
        this.scriptLoaded = true
      })
      .catch((error) => {
        console.log(error)
      })
  }

  ngOnChanges(): void {
    this.required = this.validators.includes(Validators.required)

    if (this.initialValue) {
      this.address = JSON.parse(this.initialValue)
      this.placeholder = this.address.name
    }
  }

  onAddressChange(inputAddress: GooglePlaceAddress) {
    this.address = {
      name: inputAddress.name,
      streetNumber: this.getAddressComponent(inputAddress, 'street_number'),
      route: this.getAddressComponent(inputAddress, 'route'),
      postalCode: this.getAddressComponent(inputAddress, 'postal_code'),
      locality: this.getAddressComponent(inputAddress, 'locality'),
      department: this.getAddressComponent(
        inputAddress,
        'administrative_area_level_2'
      ),
      region: this.getAddressComponent(
        inputAddress,
        'administrative_area_level_1'
      ),
      country: this.getAddressComponent(inputAddress, 'country')
    }

    this.valueChanged.emit(JSON.stringify(this.address))
  }

  private getAddressComponent(
    googlePlaceAddress: GooglePlaceAddress,
    componentName: string
  ): string {
    const addressComponent = googlePlaceAddress.address_components.find((c) =>
      c.types.includes(componentName)
    )

    return addressComponent ? addressComponent.long_name : null
  }
}
