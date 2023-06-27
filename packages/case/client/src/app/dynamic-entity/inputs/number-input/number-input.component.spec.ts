import { ComponentFixture, TestBed } from '@angular/core/testing'

import { IntegerInputComponent } from './number-input.component'

describe('IntegerInputComponent', () => {
  let component: IntegerInputComponent
  let fixture: ComponentFixture<IntegerInputComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IntegerInputComponent]
    }).compileComponents()

    fixture = TestBed.createComponent(IntegerInputComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
