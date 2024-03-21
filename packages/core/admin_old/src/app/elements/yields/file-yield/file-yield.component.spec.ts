import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileYieldComponent } from './file-yield.component';

describe('FileYieldComponent', () => {
  let component: FileYieldComponent;
  let fixture: ComponentFixture<FileYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FileYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
