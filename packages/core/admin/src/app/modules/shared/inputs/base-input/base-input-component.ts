import { Component,ElementRef,EventEmitter,Input,Output,ViewChild,OnInit } from "@angular/core";
import { NgClass } from "@angular/common";
import { PropertyManifest } from "@mnfst/types";

@Component({
    selector:'app-based-input',
    standalone:true,
    template:'',
    imports:[NgClass]
})

export class BaseInputComponent implements OnInit {
    @Input() prop:PropertyManifest
    @Input() value:string
    @Input() isError:boolean
    @Output() valueChanged:EventEmitter<string> = new EventEmitter()
    @ViewChild('input',{static:true}) input :ElementRef;
    ngOnInit(): void {
        if(this.value !==undefined){
            this.input.nativeElement.value = this.value
        }
    }
    onChange(event:any){
        this.valueChanged.emit(event.target.value)
    }
}