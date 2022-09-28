import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit
} from '@angular/core'

import { DropdownLink } from '../../../interfaces/dropdown-link.interface'
import { ResourceDefinition } from '../../../interfaces/resource-definition.interface'
import { AuthService } from '../../../services/auth.service'

@Component({
  selector: 'case-action-dropdown',
  templateUrl: './action-dropdown.component.html',
  styleUrls: ['./action-dropdown.component.scss']
})
export class ActionDropdownComponent implements OnInit {
  @Input() definition: ResourceDefinition
  @Input() item: any
  @Input() preventDeleteMessage: string

  links: DropdownLink[]
  isActive: boolean
  permissions: string[]

  constructor(
    private authService: AuthService,
    private elementRef: ElementRef
  ) {}

  async ngOnInit() {
    this.permissions = await this.authService.getPermissions()

    this.links = this.definition.dropdownLinks.filter(
      (link: DropdownLink) =>
        (!link.permission || this.permissions.includes(link.permission)) &&
        (!link.condition || link.condition(this.item))
    )
  }

  // Track outside clicks to close dropdown.
  @HostListener('document:click', ['$event.target'])
  onClick(target) {
    if (this.isActive) {
      const dropDowns: NodeList =
        this.elementRef.nativeElement.querySelectorAll('.dropdown')
      let clickedOut = true
      dropDowns.forEach((d: Node) => {
        if (d.contains(target)) {
          clickedOut = false
        }
      })
      if (clickedOut) {
        this.isActive = false
      }
    }
  }
}
