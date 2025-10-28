import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PolicyManifestCreateEditComponent } from './policy-manifest-create-edit.component';

describe('PolicyManifestCreateEditComponent', () => {
  let component: PolicyManifestCreateEditComponent;
  let fixture: ComponentFixture<PolicyManifestCreateEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PolicyManifestCreateEditComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PolicyManifestCreateEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
