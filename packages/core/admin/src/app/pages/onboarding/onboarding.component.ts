import { Component } from '@angular/core'
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms'
import { AssistantService } from '../../modules/shared/services/assistant.service'
import { NgClass } from '@angular/common'
import { FileService } from '../../modules/files/services/file.service'
import { Project } from '../../typescript/interfaces/project.interface'
import { Router } from '@angular/router'

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent {
  isLoading = false

  constructor(
    private assistantService: AssistantService,
    private fileService: FileService,
    private router: Router
  ) {}

  form = new FormGroup({
    prompt: new FormControl('', [Validators.required]),
    attachment: new FormControl(null)
  })

  onSubmit(formValue: any) {
    this.isLoading = true
    console.log(formValue)
    this.assistantService
      .createProject(formValue.prompt, formValue.attachment)
      .then(async (project: Project) => {
        this.isLoading = false
        console.log('Project created:', project)

        const manifestFileCode: string = project.messages.filter(
          (msg) => msg.type === 'system' && msg.code
        )[
          project.messages.filter((msg) => msg.type === 'system' && msg.code)
            .length - 1
        ].code!
        console.log('Manifest File Code:', manifestFileCode)

        const file = new File([manifestFileCode], 'manifest.yml', {
          type: 'text/yaml',
          lastModified: Date.now()
        })

        await this.fileService.create(file, 'manifest.yml')

        return this.router.navigate(['/'])
      })
      .catch((error) => {
        this.isLoading = false
        console.error('Error creating project:', error)
      })
  }
}
