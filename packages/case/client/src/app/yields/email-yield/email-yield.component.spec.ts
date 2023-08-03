import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailYieldComponent } from './email-yield.component';

describe('EmailYieldComponent', () => {
  let component: EmailYieldComponent;
  let fixture: ComponentFixture<EmailYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EmailYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
