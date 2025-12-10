import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimestampInputComponent } from './timestamp-input.component';

describe('TimestampInputComponent', () => {
  let component: TimestampInputComponent;
  let fixture: ComponentFixture<TimestampInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimestampInputComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TimestampInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
