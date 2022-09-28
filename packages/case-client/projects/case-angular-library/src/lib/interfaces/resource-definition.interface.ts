import { Gender } from '../enums/gender.enum'
import { LinkType } from '../enums/link-type.enum'
import { ActionButton } from './action-button.interface'
import { DropdownLink } from './dropdown-link.interface'
import { KeyNumber } from './key-number.interface'

export interface ResourceDefinition {
  title: string
  nameSingular: string
  namePlural: string
  gender: Gender

  // Server-side class name.
  className: string

  icon: string

  // Path for communication with remote API.
  slug: string

  // Visible path in URL.
  path: string

  hasDetailPage?: boolean
  hasListPage?: boolean

  buttons: LinkType[]

  defaultLink: LinkType

  // Property name that is used to define the resource (ex: name, title, label...).
  mainIdentifier: string

  // Prevent delete if resource has children that will generate a Foreign Key error.
  childrenThatPreventDelete?: {
    propName: string
    preventDeleteMessage?: string
  }[]

  // Action buttons are specific functions that can be call directly from lists.
  actionButtons?: ActionButton[]

  // Dropdown links appear in the dropdown menu of each item in the lists.
  dropdownLinks?: DropdownLink[]

  // Key numbers displayed on top of list pages.
  keyNumbers?: KeyNumber[]
}
