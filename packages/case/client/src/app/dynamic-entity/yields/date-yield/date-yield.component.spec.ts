import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateYieldComponent } from './date-yield.component';

describe('DateYieldComponent', () => {
  let component: DateYieldComponent;
  let fixture: ComponentFixture<DateYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DateYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DateYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
