import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichTextYieldComponent } from './rich-text-yield.component';

describe('RichTextYieldComponent', () => {
  let component: RichTextYieldComponent;
  let fixture: ComponentFixture<RichTextYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextYieldComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RichTextYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
