import { HttpClient } from '@angular/common/http'
import { Component } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { environment } from '../../../../../environments/environment'
import { CodeEditorModule } from '@acrodata/code-editor'
import { NgIf, NgClass } from '@angular/common'
import { yaml } from '@codemirror/lang-yaml'
import { yamlSchema } from 'codemirror-json-schema/yaml'
import { Extension } from '@codemirror/state'
import $RefParser from '@apidevtools/json-schema-ref-parser'
import { firstValueFrom } from 'rxjs'

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [FormsModule, CodeEditorModule, NgIf, NgClass],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss'
})
export class EditorComponent {
  code: string
  savedCode: string
  loadingSave: boolean

  schema: any

  extensions: Extension[] = []

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    await this.loadSchema()
    await this.loadInitialFile()
  }

  onCodeChange(newCode: string) {
    this.code = newCode
  }

  async loadSchema() {
    return firstValueFrom(
      this.http.get<string>(`https://schema.manifest.build/schema.json`)
    ).then(async (response) => {
      this.schema = await $RefParser.dereference(response)
      this.extensions = [yaml(), yamlSchema(this.schema)]
    })
  }

  async loadInitialFile() {
    return firstValueFrom(
      this.http.get<{ content: string }>(
        `${environment.apiBaseUrl}/manifest-file`
      )
    ).then((response) => {
      this.code = response.content
      this.savedCode = response.content
    })
  }

  save() {
    this.loadingSave = true
    this.http
      .post(`${environment.apiBaseUrl}/manifest-file`, {
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
