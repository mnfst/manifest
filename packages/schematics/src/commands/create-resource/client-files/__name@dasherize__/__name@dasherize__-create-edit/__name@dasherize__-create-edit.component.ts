import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { FormBuilder } from '@angular/forms'

import { CaseCreateEditComponent, ResourceDefinition, Field, InputType, BreadcrumbService, FlashMessageService, ResourceService, caseCreateEditTemplate } from '@case-app/angular-library'

import { <%= camelize(name) %>Definition } from '../<%= dasherize(name) %>.definition'

@Component({ template: caseCreateEditTemplate })
export class <%= classify(name) %>CreateEditComponent extends CaseCreateEditComponent implements OnInit {

  // Remove this property to hide onboarding message.
  isOnboarding = true

  definition: ResourceDefinition = <%= camelize(name) %>Definition
  fields: Field[] = [
    {
      label: 'Name',
      property: 'name',
      className: 'is-6',
      required: true,
      inputType: InputType.Text
    }
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
