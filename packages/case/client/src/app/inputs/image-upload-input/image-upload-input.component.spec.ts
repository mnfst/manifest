import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageUploadInputComponent } from './image-upload-input.component';

describe('ImageUploadInputComponent', () => {
  let component: ImageUploadInputComponent;
  let fixture: ComponentFixture<ImageUploadInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ ImageUploadInputComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageUploadInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
