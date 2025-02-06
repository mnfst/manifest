import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimestampInputComponent } from './timestamp-input.component';
import { PropType } from '../../../../../../../types/src/crud';

describe('TimestampInputComponent', () => {
  let component: TimestampInputComponent;
  let fixture: ComponentFixture<TimestampInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimestampInputComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TimestampInputComponent);
    component = fixture.componentInstance;
    component.prop = {
      name: 'test',
      type: PropType.Timestamp
    }
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit valueChanged event with timestamp when input changes', () => {
    const numericTimestamp = 1696161600;
    const mockTimestamp = new Date(numericTimestamp).getTime();

    spyOn(component.valueChanged, 'emit');

    component.onChange({ target: { value: numericTimestamp } });

    expect(component.valueChanged.emit).toHaveBeenCalledWith(mockTimestamp);
  });

  it('should emit null if input value is empty', () => {
    spyOn(component.valueChanged, 'emit');

    component.onChange({ target: { value: '' } });

    expect(component.valueChanged.emit).toHaveBeenCalledWith(undefined);
  });

  it('should apply "is-danger" class when isError is true', () => {
    component.isError = true;
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input');
    expect(inputElement.classList.contains('is-danger')).toBe(true);
  });

  it('should not apply "is-danger" class when isError is false', () => {
    component.isError = false;
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input');
    expect(inputElement.classList.contains('is-danger')).toBe(false);
  });
});
