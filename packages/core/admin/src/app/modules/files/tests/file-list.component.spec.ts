import { ComponentFixture, TestBed } from '@angular/core/testing'

import { FileListComponent } from '../views/file-list/file-list.component'

describe('FileListComponent', () => {
  let component: FileListComponent
  let fixture: ComponentFixture<FileListComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileListComponent]
    }).compileComponents()

    fixture = TestBed.createComponent(FileListComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
