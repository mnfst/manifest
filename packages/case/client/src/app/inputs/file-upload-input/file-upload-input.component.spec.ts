import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileUploadInputComponent } from './file-upload-input.component';

describe('FileUploadInputComponent', () => {
  let component: FileUploadInputComponent;
  let fixture: ComponentFixture<FileUploadInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FileUploadInputComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileUploadInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
