import { Component, OnInit, Input } from '@angular/core'
import { FileMime } from '../../../enums/file-mime.enum'

@Component({
  selector: 'case-file-icon-yield',
  templateUrl: './file-icon-yield.component.html',
  styleUrls: ['./file-icon-yield.component.scss']
})
export class FileIconYieldComponent implements OnInit {
  @Input() path: string
  mime: FileMime

  FileMime = FileMime

  ngOnInit() {
    this.mime = this.setMime(this.path)
  }

  setMime(path: string): FileMime {
    const extension: string = (path || '').split('.').pop()

    if (extension === 'xls' || extension === 'xlsx' || extension === 'csv') {
      return FileMime.Excel
    } else if (extension === 'pdf') {
      return FileMime.Pdf
    } else if (extension === 'ppt') {
      return FileMime.Ppt
    } else if (extension === 'doc' || extension === 'docx') {
      return FileMime.Word
    } else {
      return FileMime.Other
    }
  }
}
