import { HttpClient } from '@angular/common/http'
import { Component, AfterViewInit, ElementRef } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { environment } from '../../../../../environments/environment'
import { CodeEditorModule } from '@acrodata/code-editor'
import { NgIf, NgClass } from '@angular/common'
import { yaml } from '@codemirror/lang-yaml'
import { yamlSchema } from 'codemirror-json-schema/yaml'
import { Extension } from '@codemirror/state'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import { EditorView } from '@codemirror/view'
import { hoverTooltip } from '@codemirror/view'
import $RefParser from '@apidevtools/json-schema-ref-parser'
import { firstValueFrom } from 'rxjs'
import { FlashMessageService } from '../../../shared/services/flash-message.service'

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [FormsModule, CodeEditorModule, NgIf, NgClass],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss'
})
export class EditorComponent implements AfterViewInit {
  code: string
  savedCode: string
  loadingSave: boolean

  schema: any

  extensions: Extension[] = []

  // Editor options to disable line numbers
  options = {
    lineNumbers: false
  }

  constructor(
    private http: HttpClient,
    private elementRef: ElementRef,
    private flashMessageService: FlashMessageService
  ) {}

  async ngOnInit() {
    await this.loadSchema()
    await this.loadInitialFile()
  }

  ngAfterViewInit() {
    // Add event listener to handle clicks on tooltip links
    this.elementRef.nativeElement.addEventListener('click', (event: Event) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'A' && target.closest('.cm-tooltip')) {
        event.preventDefault()
        const href = (target as HTMLAnchorElement).href
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer')
        }
      }
    })
  }

  onCodeChange(newCode: string) {
    this.code = newCode
  }

  async loadSchema() {
    return firstValueFrom(
      this.http.get<string>(`https://schema.manifest.build/schema.json`)
    ).then(async (response) => {
      this.schema = await $RefParser.dereference(response)
      this.extensions = [
        yaml(),
        yamlSchema(this.schema),
        autocompletion({
          activateOnTyping: true,
          maxRenderedOptions: 10
        }),
        keymap.of([
          ...completionKeymap,
          // Add save shortcuts
          {
            key: 'Ctrl-s',
            preventDefault: true,
            run: () => {
              this.save()
              return true
            }
          },
          {
            key: 'Cmd-s', // For Mac users
            preventDefault: true,
            run: () => {
              this.save()
              return true
            }
          }
        ]),
        hoverTooltip((view, pos, side) => {
          // This ensures hover tooltips work properly
          return null
        }),
        EditorView.theme({
          '&': {
            fontSize: '16px',
            fontFamily:
              '"JetBrains Mono", "Fira Code", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
            backgroundColor: '#f5f5dc' // Beige background
          },
          '.cm-content': {
            padding: '24px',
            lineHeight: '1.6',
            minHeight: '400px',
            color: '#4a5568',
            backgroundColor: 'transparent'
          },
          '.cm-focused': {
            outline: 'none'
          },
          '.cm-editor': {
            borderRadius: '12px', // More rounded corners
            border: '1px solid #d69e2e',
            backgroundColor: '#f5f5dc', // Beige background
            overflow: 'hidden'
          },
          '.cm-scroller': {
            fontFamily: 'inherit'
          },
          '.cm-gutters': {
            display: 'none' // Hide gutters completely (removes line numbers)
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(214, 158, 46, 0.1)' // Subtle active line highlight
          },
          '.cm-selectionMatch': {
            backgroundColor: 'rgba(214, 158, 46, 0.2)'
          },
          '.cm-searchMatch': {
            backgroundColor: '#fef3c7'
          },
          '.cm-tooltip': {
            backgroundColor: '#fffbeb',
            border: '1px solid #d69e2e',
            borderRadius: '8px',
            boxShadow:
              '0 4px 6px -1px rgba(214, 158, 46, 0.1), 0 2px 4px -1px rgba(214, 158, 46, 0.06)',
            color: '#744210',
            maxWidth: '500px !important',
            minWidth: '200px',
            width: 'max-content',
            padding: '12px 16px',
            fontSize: '14px',
            lineHeight: '1.5',
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap'
          },
          '.cm-tooltip-arrow': {
            '&:before': {
              borderTopColor: '#d69e2e'
            },
            '&:after': {
              borderTopColor: '#fffbeb'
            }
          }
        })
      ]
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
          this.loadingSave = false
          this.flashMessageService.error('Error saving file:' + error)
        },
        complete: () => {
          this.savedCode = this.code
          this.loadingSave = false
          this.flashMessageService.success('File saved successfully')
        }
      })
  }
}
