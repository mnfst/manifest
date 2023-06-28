import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'
import { SettingsService } from '../../../services/settings.service'
import { EntityDescription } from '~shared/interfaces/entity-description.interface'
import { SelectOption } from '~shared/interfaces/select-option.interface'
import { DynamicEntityService } from '../../dynamic-entity.service'

@Component({
  selector: 'app-select-input',
  template: `<select class="select" (change)="onChange($event)">
    <option value="">Select {{ prop.label }}</option>
    <option *ngFor="let option of options" [value]="option.id">
      {{ option.label }}
    </option>
  </select>`,
  styleUrls: ['./select-input.component.scss']
})
export class SelectInputComponent implements OnInit {
  @Input() prop: PropertyDescription
  @Output() valueChanged: EventEmitter<number> = new EventEmitter()

  entityDescription: EntityDescription
  options: SelectOption[]

  constructor(
    private settingsService: SettingsService,
    private dynamicEntityService: DynamicEntityService
  ) {}

  ngOnInit(): void {
    this.settingsService.loadSettings().subscribe(async (res) => {
      this.entityDescription = res.entities.find(
        (entity: EntityDescription) =>
          entity.className === this.prop.options.entityName
      )

      this.options = await this.dynamicEntityService.listSelectOptions(
        this.entityDescription.definition.slug
      )
    })
  }

  onChange(event: any): void {
    this.valueChanged.emit(event.target.value)
  }
}
