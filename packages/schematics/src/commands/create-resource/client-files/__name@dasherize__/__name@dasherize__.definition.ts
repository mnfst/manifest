import { LinkType, ResourceDefinition, ActionType } from '@casejs/angular-library'

export const <%= camelize(name) %>Definition: ResourceDefinition = {
  title: '<%= classify(name) %>s',
  nameSingular: '<%= name %>',
  namePlural: '<%= name %>s',
  className: '<%= classify(name) %>',
  mainIdentifier: 'id',
  slug: '<%= dasherize(name) %>s',
  path: '<%= dasherize(name) %>s',
  icon: 'icon-grid',
  hasDetailPage: true,
  hasListPage: true,
  buttons: [LinkType.CREATE, LinkType.EXPORT],
  defaultLink: LinkType.DETAIL,
  childrenThatPreventDelete: [],
  dropdownLinks: [
    {
      label: 'Edit',
      permission: 'edit<%= classify(name) %>s',
      action: (<%= camelize(name) %>) => ({
        type: ActionType.Link,
        link: {
          path: `${<%= camelize(name) %>Definition.path}/${<%= camelize(name) %>.id}/edit`
        }
      })
    },
    {
      label: 'Delete',
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
