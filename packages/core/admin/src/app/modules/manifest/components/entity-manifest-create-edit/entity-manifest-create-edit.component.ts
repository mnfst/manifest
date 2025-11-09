import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import {
  EntityManifest,
  EntityRule,
  ImageSize,
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
import { propTypeOptionsRecord } from '../../../../typescript/records/prop-type-options.record'
import { policyRules } from '../../content/policy-rules.content'
import { ADMIN_ACCESS_POLICY } from '../../../../../constants'

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
  @Input() authenticableEntities: EntityManifest[] = []

  @ViewChild('classNameInput') classNameInput: ElementRef<HTMLInputElement>

  policyManifests: {
    create: PolicyManifest[]
    read: PolicyManifest[]
    update: PolicyManifest[]
    delete: PolicyManifest[]
    signup: PolicyManifest[]
  }

  policyRules = policyRules

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
      ),
      policies: new FormGroup(
        policyRules.reduce((acc: { [key: string]: FormArray }, policyRule) => {
          acc[policyRule.id] = new FormArray(
            this.entityManifest?.policies[policyRule.id as EntityRule]?.map(
              (policy: PolicyManifest) => this.initPolicyFormGroup(policy)
            ) || [this.initPolicyFormGroup()]
          )
          return acc
        }, {})
      )
    })

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
      property.options = this.cleanOptionsObject(
        property.options,
        property.type
      )

      Object.keys(property).forEach((key: string) => {
        const typedKey = key as keyof PropertyManifest
        if (property[typedKey] === null) {
          delete property[typedKey]
        }
      })
    })

    // Clean policies allow array if not restricted
    Object.keys(entityManifest.policies).forEach((rule: string) => {
      entityManifest.policies[rule as EntityRule].forEach(
        (policyManifest: PolicyManifest) => {
          if (policyManifest.access !== 'restricted') {
            console.log('Deleting allow array from policy', policyManifest)
            delete policyManifest.allow
          }
        }
      )
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
      validation: new FormGroup(
        Object.keys(propertyManifest?.validation || {}).reduce(
          (acc: { [key: string]: FormControl }, key) => {
            acc[key] = new FormControl(
              propertyManifest?.validation[
                key as keyof typeof propertyManifest.validation
              ]
            )
            return acc
          },
          {}
        )
      ),
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
        sizes: new FormArray(
          ((propertyManifest?.options['sizes'] as ImageSize[]) || []).map(
            (size) =>
              new FormGroup({
                name: new FormControl(size.name, Validators.required),
                width: new FormControl(size.width, [Validators.min(1)]),
                height: new FormControl(size.height, [Validators.min(1)])
              })
          )
        )
      })
    })
  }

  /**
   * Gets the policies FormArray for a given rule.
   *
   * @param rule The rule to get the policies for.
   *
   * @returns The policies FormArray for the given rule.
   */
  getPolicies(rule: Rule): FormArray {
    return this.form.get('policies')?.get(rule) as FormArray
  }

  initPolicyFormGroup(policyManifest?: PolicyManifest): FormGroup {
    return new FormGroup({
      access: new FormControl(
        policyManifest?.access || ADMIN_ACCESS_POLICY.access
      ),
      allow: new FormArray(
        (policyManifest?.allow || []).map((item) => new FormControl(item))
      ),
      condition: new FormControl(policyManifest?.condition || null)
    })
  }

  /**
   * Cleans the options object of a property manifest, removing any keys that are not allowed for the given property type.
   *
   * @param options The options object to clean.
   * @param type The property type.
   *
   * @returns The cleaned options object.
   */
  cleanOptionsObject(options: PropertyManifest['options'], type: PropType) {
    const allowedOptions = propTypeOptionsRecord[type]

    if (!allowedOptions) {
      return null
    }

    Object.keys(options).forEach((key) => {
      if (!allowedOptions.includes(key)) {
        delete options[key]
      }
    })

    return options
  }
}
