import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyManifestCreateEditComponent } from './property-manifest-create-edit.component';

describe('PropertyManifestCreateEditComponent', () => {
  let component: PropertyManifestCreateEditComponent;
  let fixture: ComponentFixture<PropertyManifestCreateEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyManifestCreateEditComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PropertyManifestCreateEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
