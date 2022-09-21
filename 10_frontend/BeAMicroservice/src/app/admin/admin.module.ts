import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../shared/shared.module';
import { DataListComponent } from './data-list/data-list.component';
import { ControlPadComponent } from './control-pad/control-pad.component';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { FormsModule } from '@angular/forms';



@NgModule({
  declarations: [
    DataListComponent,
    ControlPadComponent,
    AdminLayoutComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    FormsModule
  ],
  exports: [
    AdminLayoutComponent
  ]
})
export class AdminModule { }
