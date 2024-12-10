import { NgClass } from '@angular/common'
import { Component, EventEmitter, Input, Output } from '@angular/core'
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'

import { PropertyManifest } from '@repo/types'
import { QuillModule } from 'ngx-quill'

@Component({
  selector: 'app-rich-text-input',
  standalone: true,
  imports: [NgClass, QuillModule, ReactiveFormsModule],
  template: `<label [for]="prop.name">{{ prop.name }}</label>
    <form [formGroup]="form">
      <div class="control" [ngClass]="{ 'is-danger': isError }">
        <quill-editor
          [modules]="modules"
          placeholder=""
          formControlName="editor"
        ></quill-editor>
      </div>
    </form>`,
  styleUrl: './rich-text-input.component.scss'
})
export class RichTextInputComponent {
  @Input() prop: PropertyManifest
  @Input() value: string
  @Input() isError: boolean

  @Output() valueChanged: EventEmitter<string> = new EventEmitter()

  modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['link', 'blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }]
    ]
  }

  form: FormGroup

  constructor(private formBuilder: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      editor: [this.value || '']
    })

    this.form.valueChanges.subscribe((value) => {
      this.valueChanged.emit(value.editor)
    })
  }
}
