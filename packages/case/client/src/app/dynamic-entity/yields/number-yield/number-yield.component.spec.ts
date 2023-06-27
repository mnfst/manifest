import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NumberYieldComponent } from './number-yield.component';

describe('NumberYieldComponent', () => {
  let component: NumberYieldComponent;
  let fixture: ComponentFixture<NumberYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NumberYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NumberYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
