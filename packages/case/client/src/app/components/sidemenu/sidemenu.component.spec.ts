import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SidemenuComponent } from './sidemenu.component';

describe('SidemenuComponent', () => {
  let component: SidemenuComponent;
  let fixture: ComponentFixture<SidemenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SidemenuComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SidemenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
