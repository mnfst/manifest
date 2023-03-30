import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { FormBuilder } from '@angular/forms'

import { CaseCreateEditComponent, ResourceDefinition, Field, InputType, BreadcrumbService, FlashMessageService, ResourceService, caseCreateEditTemplate } from '@casejs/angular-library'

import { environment } from '../../../../environments/environment'
import { <%= camelize(name) %>Definition } from '../<%= dasherize(name) %>.definition'

@Component({ template: caseCreateEditTemplate })
export class <%= classify(name) %>CreateEditComponent extends CaseCreateEditComponent implements OnInit {

  // Remove this property to hide onboarding message.
  isOnboarding = environment.isOnboarding

  definition: ResourceDefinition = <%= camelize(name) %>Definition
  fields: Field[] = [
  ]

  constructor(
    formBuilder: FormBuilder,
    router: Router,
    activatedRoute: ActivatedRoute,
    resourceService: ResourceService,
    breadcrumbService: BreadcrumbService,
    flashMessageService: FlashMessageService
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

  ngOnInit() {
    this.initCreateEditView()
  }
}
