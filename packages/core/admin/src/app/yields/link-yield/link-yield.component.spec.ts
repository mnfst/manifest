import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LinkYieldComponent } from './link-yield.component';

describe('LinkYieldComponent', () => {
  let component: LinkYieldComponent;
  let fixture: ComponentFixture<LinkYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LinkYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LinkYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
