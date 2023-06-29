import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CurrencyYieldComponent } from './currency-yield.component';

describe('CurrencyYieldComponent', () => {
  let component: CurrencyYieldComponent;
  let fixture: ComponentFixture<CurrencyYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CurrencyYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CurrencyYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
