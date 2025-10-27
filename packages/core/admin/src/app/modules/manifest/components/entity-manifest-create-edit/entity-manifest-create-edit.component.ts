import { Component, Input } from '@angular/core'
import { EntityManifest } from '../../../../../../../types/src'
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms'
import { EntityManifestService } from '../../services/entity-manifest.service'
import { FlashMessageService } from '../../../shared/services/flash-message.service'
import { ModalService } from '../../../shared/services/modal.service'

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

  mode: 'create' | 'edit' = 'create'
  isLoading: boolean = false

  constructor(
    private entityManifestService: EntityManifestService,
    private flashMessageService: FlashMessageService,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    this.mode = this.entityManifest ? 'edit' : 'create'

    this.title =
      this.mode === 'edit'
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

    const operation: Promise<EntityManifest> =
      this.mode === 'create'
        ? this.entityManifestService.create(formValue)
        : this.entityManifestService.update(formValue)

    await operation
      .catch(() => {
        this.flashMessageService.error(
          `Error ${this.mode === 'create' ? 'creating' : 'updating'} entity manifest`
        )
      })
      .then(() => {
        this.flashMessageService.success(
          `Entity manifest ${this.mode === 'create' ? 'created' : 'updated'} successfully`
        )
        this.closeModal()
      })
      .finally(() => {
        this.isLoading = false
      })
  }

  closeModal() {
    this.modalService.close()
  }
}
