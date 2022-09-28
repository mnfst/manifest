export interface HTMLInputEvent extends Event {
  key?: string
  target: HTMLInputElement & EventTarget
}
