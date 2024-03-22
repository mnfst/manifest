import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextYieldComponent } from './text-yield.component';

describe('TextYieldComponent', () => {
  let component: TextYieldComponent;
  let fixture: ComponentFixture<TextYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TextYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TextYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
