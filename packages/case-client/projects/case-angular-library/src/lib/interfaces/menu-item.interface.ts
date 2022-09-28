export interface MenuItem {
  label: string
  permissionsOr: string[]
  icon: string
  routePath?: string
  items?: {
    label: string
    permissionsOr: string[]
    routePath: string
  }[]
}
