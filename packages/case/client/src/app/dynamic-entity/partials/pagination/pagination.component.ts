import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output
} from '@angular/core'
import { Paginator } from '@casejs/types'

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss']
})
export class PaginationComponent implements OnChanges {
  @Input() paginator: Paginator<any>
  @Output() pageChanged: EventEmitter<number> = new EventEmitter()
  pageArray: number[]

  ngOnChanges() {
    this.pageArray = this.createPageArray(
      this.paginator.currentPage,
      this.paginator.lastPage
    )
  }

  goToPage(pageNumber: number) {
    this.pageChanged.emit(pageNumber)
    this.pageArray = this.createPageArray(pageNumber, this.paginator.lastPage)
  }

  createPageArray(currentPage: number, lastPage: number): number[] {
    let paginatorStartPage: number
    let paginatorLastPage: number

    if (lastPage <= 5) {
      // less than 5 pages so show all
      paginatorStartPage = 1
      paginatorLastPage = lastPage
    } else {
      // more than 5 pages so calculate start and end page
      if (currentPage <= 3) {
        paginatorStartPage = 1
        paginatorLastPage = 5
      } else if (currentPage + 2 >= lastPage) {
        paginatorStartPage = lastPage - 4
        paginatorLastPage = lastPage
      } else {
        paginatorStartPage = currentPage - 2
        paginatorLastPage = currentPage + 2
      }
    }

    const pageArray = []
    for (let i = paginatorStartPage; i <= paginatorLastPage; i += 1) {
      pageArray.push(i)
    }

    return pageArray
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
