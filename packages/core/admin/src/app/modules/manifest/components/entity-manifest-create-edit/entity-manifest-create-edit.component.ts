import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import {
  EntityManifest,
  PolicyManifest,
  PropertyManifest,
  PropType,
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
import { propTypeValidator } from '../../utils/prop-type-validator'
import { Observable } from 'rxjs'
import { HttpErrorResponse } from '@angular/common/http'

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

  @ViewChild('classNameInput') classNameInput: ElementRef<HTMLInputElement>

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

    if (this.mode === 'create') {
      // Focus the className input after view init.
      setTimeout(() => {
        this.classNameInput.nativeElement.focus()
      }, 0)
    }

    // Initialize the form.
    this.form = new FormGroup({
      authenticable: new FormControl(
        this.entityManifest?.authenticable || false
      ),
      single: new FormControl(this.entityManifest?.single || false),
      mainProp: new FormControl(this.entityManifest?.mainProp || null),
      slug: new FormControl(this.entityManifest?.slug || null),
      className: new FormControl(
        this.entityManifest?.className || null,
        Validators.required
      ),
      nameSingular: new FormControl(this.entityManifest?.nameSingular || null),
      namePlural: new FormControl(this.entityManifest?.namePlural || null),
      seedCount: new FormControl(this.entityManifest?.seedCount || 50),
      properties: new FormArray(
        this.entityManifest?.properties.map((prop: PropertyManifest) =>
          this.initPropertyFormGroup(prop)
        ) || []
      )
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

    // Clean the object removing null values and empty options.
    Object.keys(entityManifest).forEach((key: string) => {
      const typedKey = key as keyof EntityManifest
      if (entityManifest[typedKey] === null) {
        delete entityManifest[typedKey]
      }
    })

    entityManifest.properties.forEach((property: PropertyManifest) => {
      Object.keys(property).forEach((key: string) => {
        const typedKey = key as keyof PropertyManifest
        if (property[typedKey] === null) {
          delete property[typedKey]
        }
      })

      // Only some property types have options.
      if (
        ![PropType.Choice, PropType.Money, PropType.Image].includes(
          property.type
        )
      ) {
        delete property.options
      } else {
        Object.keys(property.options).forEach((key: string) => {
          if (property.options[key] === null) {
            delete property.options[key]
          }
        })
      }
    })

    console.log('Submitting entity manifest form', entityManifest)

    const operation: Observable<EntityManifest> =
      this.mode === 'create'
        ? this.entityManifestService.create(entityManifest)
        : this.entityManifestService.update(entityManifest)

    return operation.subscribe({
      error: (error: HttpErrorResponse) => {
        this.flashMessageService.error(
          `Error ${this.mode === 'create' ? 'creating' : 'updating'} entity manifest: ${error.error.message}`
        )
      },
      next: () => {
        this.flashMessageService.success(
          `Entity manifest ${this.mode === 'create' ? 'created' : 'updated'} successfully`
        )
        this.closeModal()
      },
      complete: () => {
        this.isLoading = false
      }
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
    this.properties.push(this.initPropertyFormGroup())
  }

  /**
   * Removes a property from the properties form array.
   *
   * @param index The index of the property to remove.
   */
  removeProperty(index: number) {
    this.properties.removeAt(index)
  }

  /**
   *
   * Duplicates a property in the properties form array.
   *
   * @param index The index of the property to duplicate.
   */
  duplicateProperty(index: number): void {
    const propertyToDuplicate = this.properties.at(index) as FormGroup

    const duplicatedProperty = this.initPropertyFormGroup({
      ...propertyToDuplicate.value,
      name: propertyToDuplicate.get('name')?.value + ' Copy'
    })

    this.properties.insert(index + 1, duplicatedProperty)
  }

  /**
   * Initializes a FormGroup for a property manifest.
   *
   * @param propertyManifest The property manifest to initialize the form group with.
   *
   * @returns The initialized FormGroup.
   */
  initPropertyFormGroup(propertyManifest?: PropertyManifest): FormGroup {
    return new FormGroup({
      name: new FormControl(propertyManifest?.name, Validators.required),
      type: new FormControl(propertyManifest?.type, propTypeValidator),
      helpText: new FormControl(propertyManifest?.helpText || null),
      default: new FormControl(propertyManifest?.default || null),
      hidden: new FormControl(propertyManifest?.hidden || false),
      options: new FormGroup({
        currency: new FormControl(propertyManifest?.options['currency']),
        values: new FormArray(
          ((propertyManifest?.options['values'] as string[]) || []).map(
            (value) => new FormControl(value)
          )
        ),
        sequential: new FormControl(
          propertyManifest?.options['sequential'] || false
        ),
        sizes: new FormArray([]) // TODO: Existing sizes initialization.
      })
    })
  }
}
