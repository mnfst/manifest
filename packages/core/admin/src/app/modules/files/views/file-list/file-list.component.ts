import { Component, OnInit } from '@angular/core'
import { FileService } from '../../services/file.service'
import { StorageFile, StorageFolder } from '@repo/types'
import { DatePipe, NgFor, NgIf } from '@angular/common'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { FileSizePipe } from '../../../shared/pipes/file-size.pipe'

@Component({
  selector: 'app-file-list',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FileSizePipe],
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss'
})
export class FileListComponent implements OnInit {
  files: StorageFile[] = []
  folders: StorageFolder[] = []

  loading: boolean = false
  breadcrumbs: { path: string; label: string }[] = []

  constructor(
    private fileService: FileService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe((params: Params) => {
      const path = params['path'] || ''
      this.breadcrumbs = path
        ? path
            .split('/')
            .map(
              (
                part: string,
                index: number,
                arr: { path: string; label: string }[]
              ) => ({
                path: arr.slice(0, index + 1).join('/') + '/',
                label: part
              })
            )
        : []

      this.loading = true
      this.fileService.list(params['path']).then((res) => {
        this.files = res.files
        this.folders = res.folders
        this.loading = false
      })
    })
  }

  navigateTo(path: string) {
    this.router.navigate(['files'], {
      queryParams: { path }
    })
  }
}
