import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrimarySidebarComponent } from './primary-sidebar.component';

describe('PrimarySidebarComponent', () => {
  let component: PrimarySidebarComponent;
  let fixture: ComponentFixture<PrimarySidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrimarySidebarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PrimarySidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
