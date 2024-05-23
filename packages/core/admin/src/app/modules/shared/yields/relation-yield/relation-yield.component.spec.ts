import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RelationYieldComponent } from './relation-yield.component';

describe('RelationYieldComponent', () => {
  let component: RelationYieldComponent;
  let fixture: ComponentFixture<RelationYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RelationYieldComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RelationYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
