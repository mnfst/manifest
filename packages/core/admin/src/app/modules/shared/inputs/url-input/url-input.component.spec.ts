import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UrlInputComponent } from './url-input.component';

describe('UrlInputComponent', () => {
  let component: UrlInputComponent;
  let fixture: ComponentFixture<UrlInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UrlInputComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UrlInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
