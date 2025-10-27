import { Component, Input } from '@angular/core'
import { EntityManifest } from '../../../../../../../types/src'
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { EntityManifestService } from '../../services/entity-manifest.service'

@Component({
  selector: 'app-entity-manifest-create-edit',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './entity-manifest-create-edit.component.html',
  styleUrl: './entity-manifest-create-edit.component.scss'
})
export class EntityManifestCreateEditComponent {
  @Input() entityManifest: EntityManifest

  form: FormGroup
  title: string

  isLoading: boolean = false

  constructor(private entityManifestService: EntityManifestService) {}

  ngOnInit() {
    this.title = this.entityManifest
      ? `Edit collection: ${this.entityManifest.namePlural}`
      : 'Create collection'

    this.form = new FormGroup({
      authenticable: new FormControl(
        this.entityManifest?.authenticable || false
      ),
      single: new FormControl(this.entityManifest?.single || false),
      mainProp: new FormControl(this.entityManifest?.mainProp || ''),
      slug: new FormControl(this.entityManifest?.slug || ''),
      className: new FormControl(this.entityManifest?.className || ''),
      nameSingular: new FormControl(this.entityManifest?.nameSingular || ''),
      namePlural: new FormControl(this.entityManifest?.namePlural || ''),
      seedCount: new FormControl(this.entityManifest?.seedCount || 50)
    })
  }

  async submit(formValue: EntityManifest) {
    this.isLoading = true
    await this.entityManifestService
      .update(formValue)
      .catch(() => {
        console.log('Error updating entity manifest')
      })
      .then(() => {
        console.log('Entity manifest updated successfully')
      })
      .finally(() => {
        this.isLoading = false
      })
  }
}
