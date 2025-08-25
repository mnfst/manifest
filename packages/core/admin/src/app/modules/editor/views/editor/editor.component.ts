import { HttpClient } from '@angular/common/http'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MonacoEditorModule } from 'ngx-monaco-editor-v2'
import { environment } from '../../../../../environments/environment'
import { NgIf, NgClass } from '@angular/common'

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [MonacoEditorModule, FormsModule, NgIf, NgClass],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss'
})
export class EditorComponent {
  editorOptions = {
    language: 'yaml',
    minimap: {
      enabled: false
    }
  }
  code: string
  savedCode: string
  loadingSave: boolean

  constructor(private http: HttpClient) {}
  ngOnInit() {
    this.http
      .get<{ content: string }>(`${environment.apiBaseUrl}/manifest/file`)
      .subscribe((response) => {
        this.code = response.content
        this.savedCode = response.content
      })
  }

  onCodeChange(newCode: string) {
    this.code = newCode
  }

  save() {
    this.loadingSave = true
    this.http
      .post(`${environment.apiBaseUrl}/manifest/file`, {
        content: this.code
      })
      .subscribe({
        error: (error) => {
          console.error('Error saving file:', error)
          this.loadingSave = false
        },
        complete: () => {
          this.savedCode = this.code
          this.loadingSave = false
        }
      })
  }
}
