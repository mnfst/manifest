import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocationYieldComponent } from './location-yield.component';

describe('LocationYieldComponent', () => {
  let component: LocationYieldComponent;
  let fixture: ComponentFixture<LocationYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LocationYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LocationYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
