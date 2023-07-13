import { PropertyOptions } from './property-options.interface'

export interface FileOptions extends PropertyOptions {
  /*
   * The file types that are accepted by the input.
   * Follow accept attribute specification: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept
   * Example: accept="image/png, image/jpeg"
   * */
  accept?: string
}
