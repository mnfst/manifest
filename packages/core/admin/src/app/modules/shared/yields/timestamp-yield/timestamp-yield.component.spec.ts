import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimestampYieldComponent } from './timestamp-yield.component';

describe('TimestampYieldComponent', () => {
  let component: TimestampYieldComponent;
  let fixture: ComponentFixture<TimestampYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimestampYieldComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TimestampYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
