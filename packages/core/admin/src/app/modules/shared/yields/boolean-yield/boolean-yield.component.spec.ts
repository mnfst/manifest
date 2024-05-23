import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BooleanYieldComponent } from './boolean-yield.component';

describe('BooleanYieldComponent', () => {
  let component: BooleanYieldComponent;
  let fixture: ComponentFixture<BooleanYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BooleanYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BooleanYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
