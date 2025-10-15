import { Component, OnInit } from '@angular/core'
import { FileService } from '../../services/file.service'
import { StorageFile, StorageFolder } from '@repo/types'
import { DatePipe, NgFor, NgIf, NgClass } from '@angular/common'
import { ActivatedRoute, Params, Router } from '@angular/router'
import { FileSizePipe } from '../../../shared/pipes/file-size.pipe'

@Component({
  selector: 'app-file-list',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FileSizePipe, NgClass],
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss'
})
export class FileListComponent implements OnInit {
  files: StorageFile[] = []
  folders: StorageFolder[] = []

  loadingList: boolean = false
  loadingUpload: boolean = false
  breadcrumbs: { path: string; label: string }[] = []
  currentPath: string = ''
  highlightedFileName: string | null = null

  constructor(
    private fileService: FileService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe((params: Params) => {
      const path = params['path'] || ''
      this.currentPath = path
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
      this.loadFiles(path)
    })
  }

  navigateTo(path: string) {
    this.router.navigate(['files'], {
      queryParams: { path }
    })
  }

  async loadFiles(path: string) {
    this.loadingList = true
    const res = await this.fileService.list(path)
    this.files = res.files
    this.folders = res.folders
    this.loadingList = false
  }

  async uploadFile(currentPath: string) {
    const input = document.createElement('input')
    input.type = 'file'

    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement
      const file: File = target.files?.[0]

      if (file) {
        this.loadingUpload = true

        try {
          await this.fileService.create(
            file,
            currentPath ? currentPath + file.name : file.name
          )

          console.log('Upload successful')

          // Refresh the file list after upload
          await this.loadFiles(currentPath)
          
          // Highlight the newly uploaded file
          this.highlightedFileName = file.name
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            this.highlightedFileName = null
          }, 3000)

        } catch (error) {
          console.error('Upload failed:', error)
        } finally {
          this.loadingUpload = false
        }
      }
    }

    input.click()
  }
}
