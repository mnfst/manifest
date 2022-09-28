export interface Paginator<T> {
  data: T[]
  currentPage: number
  lastPage: number
  from: number
  to: number
  total: number
  perPage: number
}
