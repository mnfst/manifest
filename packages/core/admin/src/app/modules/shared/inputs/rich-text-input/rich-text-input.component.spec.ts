import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichTextInputComponent } from './rich-text-input.component';

describe('RichTextInputComponent', () => {
  let component: RichTextInputComponent;
  let fixture: ComponentFixture<RichTextInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextInputComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RichTextInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
