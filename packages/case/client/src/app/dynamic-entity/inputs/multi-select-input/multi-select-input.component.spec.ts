import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiSelectInputComponent } from './multi-select-input.component';

describe('MultiSelectInputComponent', () => {
  let component: MultiSelectInputComponent;
  let fixture: ComponentFixture<MultiSelectInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MultiSelectInputComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MultiSelectInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
