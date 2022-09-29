import { Component, OnInit } from '@angular/core'
import { FormBuilder } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'

import { CaseCreateEditComponent } from '../../../components/case-create-edit.component'
import { ResourceMode } from '../../../enums/resource-mode.enum'
import { Field } from '../../../interfaces/field.interface'
import { ResourceDefinition } from '../../../interfaces/resource-definition.interface'
import { Permission } from '../../../interfaces/resources/permission.interface'
import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { ResourceService } from '../../../services/resource.service'
import { roleDefinition } from '../role.definition'
import { roleFields } from '../role.fields'

@Component({
  selector: 'app-role-create-edit',
  templateUrl: './role-create-edit.component.html',
  styleUrls: ['./role-create-edit.component.scss']
})
export class RoleCreateEditComponent
  extends CaseCreateEditComponent
  implements OnInit
{
  override definition: ResourceDefinition = roleDefinition
  override fields: Field[] = roleFields

  permissions: Permission[]

  constructor(
    activatedRoute: ActivatedRoute,
    formBuilder: FormBuilder,
    router: Router,
    breadcrumbService: BreadcrumbService,
    resourceService: ResourceService,
    flashMessageService: FlashMessageService,
    private customActivatedRoute: ActivatedRoute,
    private customResourceService: ResourceService,
    private customFormBuilder: FormBuilder
  ) {
    super(
      formBuilder,
      router,
      breadcrumbService,
      resourceService,
      flashMessageService,
      activatedRoute
    )
  }

  async ngOnInit() {
    this.initRoleCreateEditView()
  }

  async initRoleCreateEditView() {
    if (
      typeof this.customActivatedRoute?.snapshot?.data?.mode !== 'undefined'
    ) {
      this.mode = this.customActivatedRoute?.snapshot?.data?.mode
    }
    this.redirectTo = this.customActivatedRoute.snapshot.queryParams.redirectTo

    const queryParams: { [key: string]: string } =
      this.customActivatedRoute?.snapshot?.queryParams
    const params: { [key: string]: string } =
      this.customActivatedRoute?.snapshot?.params

    if (queryParams?.redirectTo) {
      this.redirectTo = queryParams?.redirectTo
    }
    if (queryParams?.redirectToQueryParams) {
      this.redirectToQueryParams =
        queryParams?.redirectToQueryParams &&
        JSON.parse(queryParams.redirectToQueryParams)
    }

    // Apply special rules from queryParams.
    if (queryParams?.specialRules) {
      this.fieldSpecialRules =
        (queryParams?.specialRules && JSON.parse(queryParams.specialRules)) ||
        []
    }

    if (this.mode === ResourceMode.Edit && !this.item) {
      this.item = await this.customResourceService
        .show(this.definition.slug, params.id)
        .then((itemRes) => itemRes)
    }

    // Get list of permissions to display.
    this.permissions = await this.customResourceService
      .list('permissions')
      .then((res) => res)

    this.resolvedFields = await this.resolveFields(this.fields)
    this.form = await this.generateForm(this.fields)

    // Check permissionIds boxes.
    this.permissions.forEach((permission: Permission) => {
      if (
        this.item &&
        this.item.permissions.find((p: Permission) => p.id === permission.id)
      ) {
        permission.selected = true
      }
    })
    this.form.addControl('permissionIds', this.customFormBuilder.array([]))
    this.form
      .get('permissionIds')
      .setValue(this.item ? this.item.permissions.map((p) => p.id) : [])

    this.setBreadcrumbs()
  }

  toggleSelected(permission: Permission) {
    permission.selected = !permission.selected

    const rolePermissionIds: number[] = this.form.get('permissionIds').value
    const index = rolePermissionIds.indexOf(permission.id)

    if (index !== -1) {
      rolePermissionIds.splice(index, 1)
    } else {
      rolePermissionIds.push(permission.id)
    }
  }

  selectAll() {
    this.permissions.forEach((p) => (p.selected = true))
    this.form.get('permissionIds').setValue(this.permissions.map((p) => p.id))
  }

  selectNone() {
    this.permissions.forEach((p) => (p.selected = false))
    this.form.get('permissionIds').setValue([])
  }
}
