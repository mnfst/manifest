import { Component } from '@angular/core'
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms'
import { AssistantService } from '../../modules/shared/services/assistant.service'
import { BrowserModule } from '@angular/platform-browser'
import { NgClass } from '@angular/common'

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule, BrowserModule, NgClass],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent {
  isLoading = false

  constructor(private assistantService: AssistantService) {}

  form = new FormGroup({
    prompt: new FormControl('', [Validators.required]),
    attachment: new FormControl(null)
  })

  onSubmit(formValue: any) {
    this.isLoading = true
    console.log(formValue)
    this.assistantService
      .createProject(formValue.prompt, formValue.attachment)
      .then((response) => {
        this.isLoading = false
        console.log('Project created:', response)
      })
      .catch((error) => {
        this.isLoading = false
        console.error('Error creating project:', error)
      })
  }
}
