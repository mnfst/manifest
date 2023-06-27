import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StringInputComponent } from './string-input.component';

describe('StringInputComponent', () => {
  let component: StringInputComponent;
  let fixture: ComponentFixture<StringInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StringInputComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StringInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
