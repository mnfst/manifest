import { ComponentFixture, TestBed } from '@angular/core/testing'

import { ProgressBarYieldComponent } from './progress-bar-yield.component'

describe('ProgressBarYieldComponent', () => {
  let component: ProgressBarYieldComponent
  let fixture: ComponentFixture<ProgressBarYieldComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProgressBarYieldComponent]
    }).compileComponents()

    fixture = TestBed.createComponent(ProgressBarYieldComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
