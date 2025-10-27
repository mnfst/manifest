import { Component, Input } from '@angular/core'
import { EntityManifest } from '../../../../../../../types/src'
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms'
import { EntityManifestService } from '../../services/entity-manifest.service'
import { FlashMessageService } from '../../../shared/services/flash-message.service'
import { ModalService } from '../../../shared/services/modal.service'
import { NgClass, NgFor, NgIf } from '@angular/common'
import { PropertyManifestCreateEditComponent } from '../property-manifest-create-edit/property-manifest-create-edit.component'

@Component({
  selector: 'app-entity-manifest-create-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgClass,
    NgIf,
    NgFor,
    PropertyManifestCreateEditComponent
  ],
  templateUrl: './entity-manifest-create-edit.component.html',
  styleUrl: './entity-manifest-create-edit.component.scss'
})
export class EntityManifestCreateEditComponent {
  @Input() entityManifest: EntityManifest

  form: FormGroup
  title: string

  mode: 'create' | 'edit' = 'create'
  activeTab: 'fields' | 'policies' | 'options' = 'fields'
  isLoading: boolean = false

  constructor(
    private entityManifestService: EntityManifestService,
    private flashMessageService: FlashMessageService,
    private modalService: ModalService
  ) {}

  ngOnInit() {
    // Setup mode and title.
    this.mode = this.entityManifest ? 'edit' : 'create'
    this.title =
      this.mode === 'edit'
        ? `Edit collection: ${this.entityManifest.namePlural}`
        : 'Create collection'

    // Initialize the form.
    this.form = new FormGroup({
      authenticable: new FormControl(
        this.entityManifest?.authenticable || false
      ),
      single: new FormControl(this.entityManifest?.single || false),
      mainProp: new FormControl(this.entityManifest?.mainProp || ''),
      slug: new FormControl(this.entityManifest?.slug || ''),
      className: new FormControl(
        this.entityManifest?.className || '',
        Validators.required
      ),
      nameSingular: new FormControl(this.entityManifest?.nameSingular || ''),
      namePlural: new FormControl(this.entityManifest?.namePlural || ''),
      seedCount: new FormControl(this.entityManifest?.seedCount || 50),
      properties: new FormArray([]) // TODO: Add existing properties if in edit mode.
    })
  }

  /**
   * Submits the form to create or update the entity manifest.
   *
   * @param formValue The value of the form to submit.
   *
   * @returns A promise that resolves when the operation is complete.
   */
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

  /**
   * Gets the properties FormArray.
   */
  get propertiesFormArray(): FormArray {
    return this.form.get('properties') as FormArray
  }

  /**
   * Tells the modal service to close the modal.
   */
  closeModal() {
    this.modalService.close()
  }

  /**
   * Adds a new field to the properties form array.
   */
  addField() {
    const properties = this.form.get('properties') as FormArray
    const newPropertyGroup = new FormGroup({
      name: new FormControl(''),
      type: new FormControl('string')
    })
    properties.push(newPropertyGroup)
  }
}
