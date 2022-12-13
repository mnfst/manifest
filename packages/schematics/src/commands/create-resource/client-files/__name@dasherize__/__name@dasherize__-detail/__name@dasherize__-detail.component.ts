import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import {
  BreadcrumbService,
  CaseDetailComponent,
  FlashMessageService,
  ResourceDefinition,
  ResourceService,
} from '@case-app/angular-library'

import { <%= camelize(name) %>Definition } from '../<%= dasherize(name) %>.definition'

@Component({ 
  templateUrl: './<%= dasherize(name) %>-detail.component.html',
  styleUrls: ['./<%= dasherize(name) %>-detail.component.scss']
 })
export class <%= classify(name) %>DetailComponent extends CaseDetailComponent implements OnInit {
  definition: ResourceDefinition = <%= camelize(name) %>Definition

  constructor(
    breadcrumbService: BreadcrumbService,
    resourceService: ResourceService,
    flashMessageService: FlashMessageService,
    activatedRoute: ActivatedRoute,
  ) {
    super(
      breadcrumbService,
      resourceService,
      flashMessageService,
      activatedRoute
    )
  }

  async ngOnInit(): Promise<void> {
    await this.initDetailView()
  }
}
