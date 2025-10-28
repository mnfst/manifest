import { NgFor, NgIf } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { AccessPolicy, PolicyManifest } from '../../../../../../../types/src'
import { FormControl, FormGroup } from '@angular/forms'

@Component({
  selector: 'app-policy-manifest-create-edit',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './policy-manifest-create-edit.component.html',
  styleUrl: './policy-manifest-create-edit.component.scss'
})
export class PolicyManifestCreateEditComponent {
  @Input() policyManifest: PolicyManifest

  @Output() policyManifestChange: EventEmitter<PolicyManifest> =
    new EventEmitter<PolicyManifest>()

  accesses: AccessPolicy[] = ['public', 'restricted', 'forbidden', 'admin']

  form: FormGroup

  ngOnInit(): void {
    this.form = new FormGroup({
      access: new FormControl(this.policyManifest?.access || 'admin'),
      allow: new FormControl(this.policyManifest?.allow || []),
      condition: new FormControl(this.policyManifest?.condition || null)
    })

    this.form.valueChanges.subscribe((value) => {
      this.policyManifestChange.emit({
        access: value.access,
        allow: value.allow.length > 0 ? value.allow : undefined,
        condition: value.condition || undefined
      })
    })
  }

  setAccess(access: AccessPolicy) {
    this.form.get('access').setValue(access)
  }
}
