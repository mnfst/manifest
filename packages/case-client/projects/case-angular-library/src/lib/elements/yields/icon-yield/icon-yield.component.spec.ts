import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IconYieldComponent } from './icon-yield.component';

describe('IconYieldComponent', () => {
  let component: IconYieldComponent;
  let fixture: ComponentFixture<IconYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IconYieldComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(IconYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
