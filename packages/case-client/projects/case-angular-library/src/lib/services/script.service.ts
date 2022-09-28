import { Injectable } from '@angular/core'

@Injectable({
  providedIn: 'root'
})
export class ScriptService {
  private loadedScripts: string[] = []

  load(src: string) {
    return new Promise((resolve, reject) => {
      if (this.loadedScripts.includes(src)) {
        resolve({ script: src, loaded: true, status: 'Already Loaded' })
      } else {
        let script: any = document.createElement('script')
        script.type = 'text/javascript'
        script.src = src
        if (script.readyState) {
          // Internet Explorer.
          script.onreadystatechange = () => {
            if (
              script.readyState === 'loaded' ||
              script.readyState === 'complete'
            ) {
              script.onreadystatechange = null
              this.loadedScripts.push(src)
              resolve({ script: src, loaded: true, status: 'Loaded' })
            }
          }
        } else {
          //Others
          script.onload = () => {
            this.loadedScripts.push(src)
            resolve({ script: src, loaded: true, status: 'Loaded' })
          }
        }
        script.onerror = (error: any) =>
          resolve({ script: src, loaded: false, status: 'Loaded' })
        document.getElementsByTagName('head')[0].appendChild(script)
      }
    })
  }
}
