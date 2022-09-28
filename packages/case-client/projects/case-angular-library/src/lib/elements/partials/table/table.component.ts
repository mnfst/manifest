import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output
} from '@angular/core'

import { Gender } from '../../../enums/gender.enum'
import { LinkType } from '../../../enums/link-type.enum'
import { YieldType } from '../../../enums/yield-type.enum'
import { ActionButton } from '../../../interfaces/action-button.interface'
import { OrderByChangedEvent } from '../../../interfaces/order-by-changed-event.interface'
import { ResourceDefinition } from '../../../interfaces/resource-definition.interface'
import { Yield } from '../../../interfaces/yield.interface'
import { ActionService } from '../../../services/action.service'
import { AuthService } from '../../../services/auth.service'

@Component({
  selector: 'case-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss']
})
export class TableComponent implements OnChanges {
  @Input() items: any[]
  @Input() definition: ResourceDefinition
  @Input() yields: Yield[]
  @Input() hiddenProps: string[] = []
  @Input() orderByDesc = false
  @Input() orderBy: string
  @Input() allowOrderBy = true

  @Output() customEventEmitter: EventEmitter<any> = new EventEmitter()
  @Output()
  orderByChanged: EventEmitter<OrderByChangedEvent> = new EventEmitter()

  formattedItems: { [key: string]: any }[]

  itemToDelete: any
  YieldType = YieldType
  Gender = Gender

  constructor(
    private authService: AuthService,
    private actionService: ActionService
  ) {}

  async ngOnChanges() {
    const permissions = await this.authService.getPermissions()

    this.yields = this.hiddenProps.length
      ? this.yields.filter(
          (y) =>
            !this.hiddenProps.find((hiddenProp) => hiddenProp === y.property)
        )
      : this.yields

    this.yields.forEach((y: Yield) => {
      if (!this.allowOrderBy) {
        y.disableOrderBy = true
      }
    })

    this.items.forEach((item: any) => {
      item.yields = []
      // Create object with values to be displayed.
      this.yields.forEach((y: Yield) => {
        const itemYield: Yield = { ...y }
        itemYield.propertyValue = this.getValue(item, itemYield.property)
        itemYield.secondPropertyValue = this.getValue(
          item,
          itemYield.secondProperty
        )
        itemYield.thirdPropertyValue = this.getValue(
          item,
          itemYield.thirdProperty
        )
        itemYield.forthPropertyValue = this.getValue(
          item,
          itemYield.forthProperty
        )

        itemYield.routerLink = this.getRouterLink(itemYield, item)

        item.yields.push(itemYield)
      })

      // Action buttons.
      item.actionButtons = (this.definition.actionButtons || []).filter(
        (aB: ActionButton) =>
          (!aB.permission || permissions.includes(aB.permission)) &&
          (!aB.condition || aB.condition(item))
      )

      // Check if item can be deleted.
      if (
        this.definition.childrenThatPreventDelete &&
        this.definition.childrenThatPreventDelete.length
      ) {
        this.definition.childrenThatPreventDelete.forEach(
          (children: { propName: string; preventDeleteMessage: string }) => {
            if (
              item[children.propName] &&
              (item[children.propName] > 0 || item[children.propName].length)
            ) {
              item.preventDeleteMessage = children.preventDeleteMessage
            }
          }
        )
      }
    })

    // We make the loop on formattedItems instead of items to prevent DOM from creating before finishing format operations.
    this.formattedItems = this.items
  }

  // Emit event on changing orderBy or orderByDesc.
  order(yieldName: Yield) {
    if (yieldName.disableOrderBy) {
      return
    }

    const property = yieldName.orderByProperty || yieldName.property

    if (this.orderBy === property) {
      this.orderByDesc = !this.orderByDesc
    }
    this.orderBy = property

    this.orderByChanged.emit({
      orderBy: this.orderBy,
      orderByDesc: this.orderByDesc
    })
  }

  // Recursive getter to retrieve nested properties.
  getValue(item: any, propName?: string): any {
    let value: any

    try {
      value = propName.split('.').reduce((prev, current) => prev[current], item)
    } catch (error) {
      value = null
    }
    return value
  }

  onYieldClick(clickedYield: Yield, item: any, clickEvent: MouseEvent) {
    if (clickedYield.action) {
      clickEvent.preventDefault()
      return this.actionService.triggerAction(clickedYield.action(item))
    }
  }

  getRouterLink(
    itemYield: Yield,
    item: any
  ): { pathWithoutParams: string[]; queryParams?: { [key: string]: string } } {
    if (
      itemYield.type === YieldType.Address ||
      itemYield.type === YieldType.Download ||
      itemYield.action
    ) {
      return null
    }

    const path: string[] | string =
      typeof itemYield.link === 'function'
        ? itemYield.link(item)
        : itemYield.link

    // Default links are generated.
    if (!path) {
      if (this.definition.defaultLink === LinkType.EDIT) {
        return {
          pathWithoutParams: [
            `/${this.definition.path || this.definition.slug}`,
            item.id.toString(),
            'edit'
          ]
        }
      } else if (this.definition.defaultLink === LinkType.DETAIL) {
        return {
          pathWithoutParams: [
            `/${this.definition.path || this.definition.slug}`,
            item.id.toString()
          ]
        }
      } else {
        return null
      }
    }

    let pathWithoutParams: string[]
    let queryParams: { [key: string]: string }

    // Separate queryParams from linkPath to use in Angular Router.
    if (typeof path === 'string' && path.includes('?')) {
      const urlArray: string[] = path.split('?')
      pathWithoutParams = [urlArray[0]]
      const stringParams: string = urlArray[1]
      queryParams = JSON.parse(
        '{"' +
          decodeURI(stringParams)
            .replace(/"/g, '\\"')
            .replace(/&/g, '","')
            .replace(/=/g, '":"') +
          '"}'
      )
    } else {
      pathWithoutParams = typeof path === 'string' ? [path] : path
    }

    return {
      pathWithoutParams,
      queryParams
    }
  }
}
