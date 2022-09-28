import { Component, OnInit, Renderer2 } from '@angular/core'
import { FormBuilder } from '@angular/forms'
import { Router } from '@angular/router'

import { CaseCreateEditComponent } from '../../../components/case-create-edit.component'
import { ResourceMode } from '../../../enums/resource-mode.enum'
import { ActionService } from '../../../services/action.service'
import { BreadcrumbService } from '../../../services/breadcrumb.service'
import { FlashMessageService } from '../../../services/flash-message.service'
import { ResourceService } from '../../../services/resource.service'

@Component({
  selector: 'case-create-edit-modal',
  templateUrl: './create-edit-modal.component.html',
  styleUrls: ['./create-edit-modal.component.scss']
})
export class CreateEditModalComponent
  extends CaseCreateEditComponent
  implements OnInit
{
  title: string
  helpText: string
  mode: ResourceMode
  keyPoints: { label: string; value: string }[]

  isModal = true
  showModal: boolean

  constructor(
    formBuilder: FormBuilder,
    router: Router,
    resourceService: ResourceService,
    breadcrumbService: BreadcrumbService,
    flashMessageService: FlashMessageService,
    private actionService: ActionService,
    private renderer: Renderer2
  ) {
    super(
      formBuilder,
      router,
      breadcrumbService,
      resourceService,
      flashMessageService
    )
  }

  ngOnInit(): void {
    this.actionService.openCreateEditModalAction.subscribe(async (action) => {
      this.title = action.title
      this.helpText = action.helpText
      this.fields = action.fields
      this.definition = action.definition
      this.mode = action.mode
      this.item = action.item
      this.keyPoints = action.keyPoints
      this.patchURL = action.patchURL
      this.redirectTo = action.redirectTo
      this.redirectToQueryParams = action.redirectToQueryParams

      await this.initCreateEditView()

      this.showModal = true
      this.renderer.addClass(document.querySelector('html'), 'is-clipped')
    })
  }

  close() {
    this.showModal = false
    this.renderer.removeClass(document.querySelector('html'), 'is-clipped')
  }
}
