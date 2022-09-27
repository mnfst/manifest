// Corresponds to an item destined to be rendered in the front-end as an <option> tag in a <select> tag.
export interface SelectOption {
  label: string
  value: string | number
  subLabel?: string
  selected?: boolean
  disabled?: boolean
}
