import { Component, OnInit, Inject } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import {
  AuthService,
  BreadcrumbService,
  CaseConfig,
  CaseListComponent,
  caseListTemplate,
  Filter,
  FilterService,
  FlashMessageService,
  ResourceDefinition,
  ResourceService,
  Yield
} from '@case-app/angular-library'

import { environment } from '../../../../environments/environment'
import { <%= camelize(name) %>Definition } from '../<%= dasherize(name) %>.definition'

@Component({ template: caseListTemplate })
export class <%= classify(name) %>ListComponent extends CaseListComponent implements OnInit {
  
  // Remove this property to hide onboarding message.
  isOnboarding = environment.isOnboarding

  definition: ResourceDefinition = <%= camelize(name) %>Definition
  yields: Yield[] = [
  ]

  filters: Filter[] = []

  constructor(
    router: Router,
    activatedRoute: ActivatedRoute,
    resourceService: ResourceService,
    breadcrumbService: BreadcrumbService,
    flashMessageService: FlashMessageService,
    authService: AuthService,
    filterService: FilterService,
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
