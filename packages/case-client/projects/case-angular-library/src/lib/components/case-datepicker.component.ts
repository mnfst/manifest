import { Component } from '@angular/core'
import { IAngularMyDpOptions, IMyDateModel } from 'angular-mydatepicker'
import moment from 'moment'

@Component({
  template: 'NO UI TO BE FOUND HERE!'
})
export class CaseDatepickerComponent {
  datePickerOptions: IAngularMyDpOptions = {
    dateFormat: 'dd/mm/yyyy',
    selectorWidth: '310px',
    selectorHeight: '45px'
  }

  // Format YYYY-MM-DD to MyDatePicker format (today if date not specified)
  // Format YYYY-MM-DD to MyDatePicker format (today if date not specified)
  formatStandardDate(
    dateString = new Date().toISOString().substring(0, 10)
  ): IMyDateModel {
    // In case of NULL dateString (!! Different than empty), we return null to make datepicker empty
    if (!dateString) {
      return null
    }
    return {
      isRange: false,
      singleDate: { jsDate: moment(dateString, 'YYYY-MM-DD').toDate() },
      dateRange: null
    }
  }

  // Format MyDatePicker format date to YYYY-MM-DD
  formatMyDatePickerDate(dateObject: IMyDateModel): string {
    return dateObject
      ? `${dateObject.singleDate.date.year}-${dateObject.singleDate.date.month
          .toString()
          .padStart(2, '0')}-${dateObject.singleDate.date.day
          .toString()
          .padStart(2, '0')}`
      : null
  }
}
