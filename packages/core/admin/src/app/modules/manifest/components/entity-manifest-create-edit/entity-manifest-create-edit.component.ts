import { Component, Input } from '@angular/core'
import {
  EntityManifest,
  PropertyManifest
} from '../../../../../../../types/src'
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

  propertyManifests: PropertyManifest[]

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
      properties: new FormArray([]) // TODO: initial values on edit.
    })

    // Initialize property manifests separately for easier handling.
    this.propertyManifests = this.entityManifest
      ? this.entityManifest.properties
      : []
  }

  /**
   * Submits the form to create or update the entity manifest.
   *
   * @param entityManifest The value of the form to submit.
   *
   * @returns A promise that resolves when the operation is complete.
   */
  async submit(entityManifest: EntityManifest) {
    this.isLoading = true

    console.log('Submitting entity manifest form', entityManifest)

    const operation: Promise<EntityManifest> =
      this.mode === 'create'
        ? this.entityManifestService.create(entityManifest)
        : this.entityManifestService.update(entityManifest)

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
    this.propertyManifests.push(null)
  }

  /**
   * Handles changes to a property form.
   *
   * @param form The updated property form group.
   * @param index The index of the property in the properties array.
   */
  onPropertyFormChange(propertyManifest: PropertyManifest, index: number) {
    if (propertyManifest === null) {
      // Remove property

      this.propertyManifests.splice(index, 1)
      this.form.controls['properties'].value.splice(index, 1)
      return
    }

    // Update property
    this.form.controls['properties'].value[index] = propertyManifest

    console.log(this.form.value['properties'])
  }
}
