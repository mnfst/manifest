import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwaggerUiComponent } from './swagger-ui.component';

describe('SwaggerUiComponent', () => {
  let component: SwaggerUiComponent;
  let fixture: ComponentFixture<SwaggerUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwaggerUiComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SwaggerUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
