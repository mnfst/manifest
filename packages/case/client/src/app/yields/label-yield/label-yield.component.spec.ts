import { ComponentFixture, TestBed } from '@angular/core/testing'

import { LabelYieldComponent } from './label-yield.component'

describe('LabelYieldComponent', () => {
  let component: LabelYieldComponent
  let fixture: ComponentFixture<LabelYieldComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LabelYieldComponent]
    }).compileComponents()

    fixture = TestBed.createComponent(LabelYieldComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
