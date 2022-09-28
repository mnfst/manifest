export interface TopMenuLink {
  label: string
  icon: string
  routePath: string
  queryParams?: { [key: string]: string }
  permission?: string
}
