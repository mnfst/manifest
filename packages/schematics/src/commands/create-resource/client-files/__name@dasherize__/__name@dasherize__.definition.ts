import { Gender, LinkType, ResourceDefinition, ActionType } from '@case-app/angular-library'

export const <%= camelize(name) %>Definition: ResourceDefinition = {
  title: '<%= classify(displayName) %>s',
  nameSingular: '<%= displayName %>',
  namePlural: '<%= displayName %>s',
  className: '<%= classify(name) %>',
  mainIdentifier: 'id',
  slug: '<%= dasherize(name) %>s',
  path: '<%= dasherize(displayName) %>s',
  icon: 'icon-grid',
  gender: Gender.<%= gender %>,
  hasDetailPage: false,
  hasListPage: true,
  buttons: [LinkType.CREATE],
  defaultLink: LinkType.EDIT,
  childrenThatPreventDelete: [],
  dropdownLinks: [
    {
      label: 'Modifier',
      permission: 'edit<%= classify(name) %>s',
      action: (<%= camelize(name) %>) => ({
        type: ActionType.Link,
        link: {
          path: `${<%= camelize(name) %>Definition.path}/${<%= camelize(name) %>.id}/edit`
        }
      })
    },
    {
      label: 'Supprimer',
      permission: 'delete<%= classify(name) %>s',
      action: (<%= camelize(name) %>) => ({
        type: ActionType.Delete,
        delete: {
          itemToDelete: <%= camelize(name) %>,
          definition: <%= camelize(name) %>Definition
        }
      })
    }
  ]
}
