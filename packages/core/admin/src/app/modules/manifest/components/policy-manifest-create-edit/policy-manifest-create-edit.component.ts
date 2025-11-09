import { NgFor, NgIf, NgClass } from '@angular/common'
import { Component, Input } from '@angular/core'
import { AccessPolicy, EntityManifest } from '../../../../../../../types/src'
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule
} from '@angular/forms'
import { ADMIN_ACCESS_POLICY } from '../../../../../constants'

@Component({
  selector: 'app-policy-manifest-create-edit',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, NgClass],
  templateUrl: './policy-manifest-create-edit.component.html',
  styleUrl: './policy-manifest-create-edit.component.scss'
})
export class PolicyManifestCreateEditComponent {
  @Input() policyManifestFormArray: FormArray
  @Input() authenticableEntities: EntityManifest[] = []

  accesses: AccessPolicy[] = ['public', 'restricted', 'forbidden', 'admin']

  getPolicyFormGroup(index: number): FormGroup {
    return this.policyManifestFormArray.at(index) as FormGroup
  }

  setAccess(index: number, access: AccessPolicy): void {
    const policyFormGroup = this.getPolicyFormGroup(index)
    policyFormGroup.get('access')?.setValue(access)
  }

  addPolicyManifest() {
    const policyManifestFormGroup = new FormGroup({
      access: new FormControl<AccessPolicy>(ADMIN_ACCESS_POLICY.access),
      allow: new FormArray([]),
      condition: new FormControl(null)
    })

    this.policyManifestFormArray.push(policyManifestFormGroup)
  }

  removePolicy(index: number) {
    this.policyManifestFormArray.removeAt(index)
  }

  /**
   * Checks if all policies in the form array have 'restricted' access.
   *
   * @return boolean - True if all policies are 'restricted', false otherwise.
   */
  isAllPoliciesRestricted(): boolean {
    return this.policyManifestFormArray.controls.every(
      (policyManifestControl) =>
        policyManifestControl.get('access')?.value === 'restricted'
    )
  }

  toggleEntityAllow(index: number, entity: EntityManifest) {
    const policyManifestControl = this.getPolicyFormGroup(index)
    const allowFormArray = policyManifestControl.get('allow') as FormArray

    const entityIndex = allowFormArray.value.indexOf(entity.className)

    if (entityIndex > -1) {
      // Entity is already allowed, remove it
      allowFormArray.removeAt(entityIndex)
    } else {
      // Entity is not allowed, add it
      allowFormArray.push(new FormControl(entity.className))
    }
  }

  isEntityAllowed(index: number, entity: EntityManifest): boolean {
    const policyManifestControl = this.getPolicyFormGroup(index)
    const allowFormArray = policyManifestControl.get('allow') as FormArray

    return allowFormArray.value.includes(entity.className)
  }
}
