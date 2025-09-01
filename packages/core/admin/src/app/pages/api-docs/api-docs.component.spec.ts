import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiDocsComponent } from './api-docs.component';

describe('ApiDocsComponent', () => {
  let component: ApiDocsComponent;
  let fixture: ComponentFixture<ApiDocsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApiDocsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ApiDocsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
