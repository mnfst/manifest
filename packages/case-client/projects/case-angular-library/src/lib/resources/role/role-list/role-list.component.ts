import { Component, Inject, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'

import { CaseListComponent } from '../../../components/case-list.component'
import { CaseConfig } from '../../../interfaces/case-config.interface'
import { ResourceDefinition } from '../../../interfaces/resource-definition.interface'
import { Yield } from '../../../interfaces/yield.interface'
import { AuthService } from '../../../services/auth.service'
import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { FilterService } from '../../../services/filter.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { ResourceService } from '../../../services/resource.service'
import { caseListTemplate } from '../../../templates/case-list.template'
import { roleDefinition } from '../role.definition'
import { roleYields } from '../role.yields'

@Component({ template: caseListTemplate })
export class RoleListComponent extends CaseListComponent implements OnInit {
  override definition: ResourceDefinition = roleDefinition
  yields: Yield[] = roleYields

  constructor(
    router: Router,
    activatedRoute: ActivatedRoute,
    resourceService: ResourceService,
    breadcrumbService: BreadcrumbService,
    flashMessageService: FlashMessageService,
    filterService: FilterService,
    authService: AuthService,
    @Inject('CASE_CONFIG_TOKEN') config: CaseConfig
  ) {
    super(
      router,
      activatedRoute,
      breadcrumbService,
      resourceService,
      flashMessageService,
      authService,
      filterService,
      config
    )
  }

  ngOnInit() {
    this.initListView()
  }
}
