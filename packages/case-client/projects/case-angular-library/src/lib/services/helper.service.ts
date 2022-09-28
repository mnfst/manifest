import { Injectable } from '@angular/core'

@Injectable({
  providedIn: 'root'
})
export class HelperService {
  static classify(text: string): string {
    const string = text.replace(
      /^([A-Z])|[\s-_]+(\w)/g,
      function (_match, p1, p2) {
        if (p2) return p2.toUpperCase()
        return p1.toLowerCase()
      }
    )
    return string.charAt(0).toUpperCase() + string.slice(1)
  }

  static isObjectEmpty(obj): boolean {
    return (
      obj &&
      Object.keys(obj).length === 0 &&
      Object.getPrototypeOf(obj) === Object.prototype
    )
  }
}
