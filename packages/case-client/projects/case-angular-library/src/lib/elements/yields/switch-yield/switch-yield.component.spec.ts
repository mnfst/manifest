import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwitchYieldComponent } from './switch-yield.component';

describe('SwitchYieldComponent', () => {
  let component: SwitchYieldComponent;
  let fixture: ComponentFixture<SwitchYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SwitchYieldComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SwitchYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
