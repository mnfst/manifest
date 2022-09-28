import { ActionType } from '../../enums/action-type.enum'
import { DeleteActionConfig } from './delete-action-config.interface'
import { LinkActionConfig } from './link-action-config.interface'
import { OpenCreateEditModalActionConfig } from './open-create-edit-modal-action-config.interface'
import { PatchActionConfig } from './patch-action-config.interface'

export interface Action {
  type: ActionType

  link?: LinkActionConfig
  patch?: PatchActionConfig
  delete?: DeleteActionConfig
  openCreateEditModal?: OpenCreateEditModalActionConfig
}
