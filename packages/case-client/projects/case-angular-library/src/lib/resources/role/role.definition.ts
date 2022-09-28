import { ActionType } from '../../enums/action-type.enum'
import { Gender } from '../../enums/gender.enum'
import { LinkType } from '../../enums/link-type.enum'
import { ResourceDefinition } from '../../interfaces/resource-definition.interface'

export const roleDefinition: ResourceDefinition = {
  title: 'Rôles',
  nameSingular: 'rôle',
  namePlural: 'rôles',
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
      label: 'Editer rôle',
      permission: 'editRoles',
      action: (role) => ({
        type: ActionType.Link,
        link: {
          path: `${roleDefinition.path}/${role.id}/edit`
        }
      })
    },
    {
      label: 'Effacer rôle',
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
