import type { Component } from 'solid-js';

interface FilterCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A filter-bar chip that is a checkbox, e.g. "Include archived". */
const FilterCheckbox: Component<FilterCheckboxProps> = (props) => (
  <label class="filter-checkbox" classList={{ 'filter-checkbox--on': props.checked }}>
    <input
      type="checkbox"
      checked={props.checked}
      onChange={(e) => props.onChange(e.currentTarget.checked)}
    />
    {props.label}
  </label>
);

export default FilterCheckbox;
