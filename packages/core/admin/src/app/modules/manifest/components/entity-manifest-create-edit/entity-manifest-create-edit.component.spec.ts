import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityManifestCreateEditComponent } from './entity-manifest-create-edit.component';

describe('EntityManifestCreateEditComponent', () => {
  let component: EntityManifestCreateEditComponent;
  let fixture: ComponentFixture<EntityManifestCreateEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityManifestCreateEditComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EntityManifestCreateEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
