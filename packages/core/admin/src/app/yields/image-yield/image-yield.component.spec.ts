import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageYieldComponent } from './image-yield.component';

describe('ImageYieldComponent', () => {
  let component: ImageYieldComponent;
  let fixture: ComponentFixture<ImageYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ ImageYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
