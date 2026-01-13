/**
 * Shared types for Manifest UI components
 *
 * All components use a semantic prop structure with 4 categories:
 * - data: Content to display (arrays, objects, content)
 * - actions: User-triggerable callbacks (on* handlers)
 * - appearance: Visual configuration (variants, sizes, labels)
 * - control: State management (loading, selection, disabled)
 */

/**
 * Base component props structure
 * Each component defines its own specific types for each category
 */
export interface BaseComponentProps<
  TData = object,
  TActions = object,
  TAppearance = object,
  TControl = object
> {
  data?: TData
  actions?: TActions
  appearance?: TAppearance
  control?: TControl
}
