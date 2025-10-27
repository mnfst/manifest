import { Component, Input, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { PropType } from '../../../../../../../types/src'
import { NgFor } from '@angular/common'

@Component({
  selector: 'app-property-manifest-create-edit',
  standalone: true,
  imports: [NgFor],
  templateUrl: './property-manifest-create-edit.component.html',
  styleUrl: './property-manifest-create-edit.component.scss'
})
export class PropertyManifestCreateEditComponent implements OnInit {
  @Input() propertyFormGroup: FormGroup

  mode: 'create' | 'edit' = 'create'

  propTypesArray = Object.values(PropType).map((type) => ({
    label: type,
    value: type
  }))

  ngOnInit() {
    this.mode = this.propertyFormGroup?.value ? 'edit' : 'create'
  }
}
