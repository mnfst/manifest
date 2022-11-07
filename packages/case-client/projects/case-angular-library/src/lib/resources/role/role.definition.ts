import { ActionType } from '../../enums/action-type.enum'
import { Gender } from '../../enums/gender.enum'
import { LinkType } from '../../enums/link-type.enum'
import { ResourceDefinition } from '../../interfaces/resource-definition.interface'

export const roleDefinition: ResourceDefinition = {
  title: 'Roles',
  nameSingular: 'role',
  namePlural: 'roles',
  className: 'Role',
  icon: 'icon-pie-chart',
  gender: Gender.Masculine,
  mainIdentifier: 'displayName',
  slug: 'roles',
  path: 'roles',
  hasDetailPage: false,
  hasListPage: true,
  buttons: [LinkType.CREATE],
  defaultLink: LinkType.EDIT,
  dropdownLinks: [
    {
      label: 'Edit role',
      permission: 'editRoles',
      action: (role) => ({
        type: ActionType.Link,
        link: {
          path: `${roleDefinition.path}/${role.id}/edit`
        }
      })
    },
    {
      label: 'Delete role',
      permission: 'deleteRoles',
      action: (role) => ({
        type: ActionType.Delete,
        delete: {
          itemToDelete: role,
          definition: roleDefinition
        }
      })
    }
  ]
}
