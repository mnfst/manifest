import { Component, Input } from '@angular/core'
import {
  EntityManifest,
  PolicyManifest,
  Rule
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
import { PolicyManifestCreateEditComponent } from '../policy-manifest-create-edit/policy-manifest-create-edit.component'

@Component({
  selector: 'app-entity-manifest-create-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgClass,
    NgIf,
    NgFor,
    PropertyManifestCreateEditComponent,
    PolicyManifestCreateEditComponent
  ],
  templateUrl: './entity-manifest-create-edit.component.html',
  styleUrl: './entity-manifest-create-edit.component.scss'
})
export class EntityManifestCreateEditComponent {
  @Input() entityManifest: EntityManifest

  policyManifests: {
    create: PolicyManifest[]
    read: PolicyManifest[]
    update: PolicyManifest[]
    delete: PolicyManifest[]
    signup: PolicyManifest[]
  }

  form: FormGroup
  title: string

  mode: 'create' | 'edit' = 'create'
  activeTab: 'fields' | 'policies' | 'options' = 'fields'
  isLoading: boolean = false

  policyRules: {
    id: Rule
    label: string
    description: string
    hidden?: boolean
  }[] = [
    {
      id: 'signup',
      label: 'Signup',
      description: 'Allow new user registrations',
      hidden: true
    },
    {
      id: 'create',
      label: 'Create',
      description: 'Add new records'
    },
    {
      id: 'read',
      label: 'Read',
      description: 'View records'
    },
    {
      id: 'update',
      label: 'Update',
      description: 'Modify existing records'
    },
    {
      id: 'delete',
      label: 'Delete',
      description: 'Remove records'
    }
  ]

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

    this.policyManifests = this.entityManifest
      ? this.entityManifest.policies
      : {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        }

    this.form.valueChanges.subscribe((value) => {
      console.log('Form value changed:', value)
      const signupRule = this.policyRules.find((rule) => rule.id === 'signup')
      if (value.authenticable) {
        signupRule.hidden = false
      } else {
        signupRule.hidden = true
      }
    })
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
   * Gets the properties FormArray.
   */
  get properties(): FormArray<FormGroup> {
    return this.form.controls['properties'] as FormArray<FormGroup>
  }

  /**
   * Adds a new property to the properties form array.
   */
  addProperty() {
    const newProperty = {
      name: new FormControl('', Validators.required),
      type: new FormControl(null)
    }

    this.properties.push(new FormGroup(newProperty))
  }

  /**
   * Removes a property from the properties form array.
   *
   * @param index The index of the property to remove.
   */
  removeProperty(index: number) {
    this.properties.removeAt(index)
    console.log('Removed property at index', index, this.form)
  }
}
