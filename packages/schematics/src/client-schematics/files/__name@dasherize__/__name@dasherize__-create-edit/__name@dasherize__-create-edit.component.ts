import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { FormBuilder } from '@angular/forms'

import { CaseCreateEditComponent, ResourceDefinition, Field, Filter, InputType, BreadcrumbService, FlashMessageService, ResourceService, caseCreateEditTemplate } from '@case-app/angular-library'

import { <%= camelize(name) %>Definition } from '../<%= dasherize(name) %>.definition'

@Component({ template: caseCreateEditTemplate })
export class <%= classify(name) %>CreateEditComponent extends CaseCreateEditComponent implements OnInit {
  definition: ResourceDefinition = <%= camelize(name) %>Definition
  fields: Field[] = []

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
