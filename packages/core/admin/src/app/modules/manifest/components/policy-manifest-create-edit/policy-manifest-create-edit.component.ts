import { NgFor, NgIf, NgClass } from '@angular/common'
import { Component, Input } from '@angular/core'
import { AccessPolicy } from '../../../../../../../types/src'
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
  accesses: AccessPolicy[] = ['public', 'restricted', 'forbidden', 'admin']

  ngOnInit(): void {
    console.log('Initial ', this.policyManifestFormArray.value)

    this.policyManifestFormArray.valueChanges.subscribe((value) => {
      console.log(value)
    })
  }

  getPolicyFormGroup(index: number): FormGroup {
    console.log(
      'getting form group at index:',
      index,
      this.policyManifestFormArray.at(index).value
    )
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
}
