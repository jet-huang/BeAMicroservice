import { AppComponent } from './app.component';
import { LandingComponent } from './landing/landing.component';
import { AdminLayoutComponent } from './admin/admin-layout/admin-layout.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RequestorComponent } from './requestor/requestor.component';
import { ServerComponent } from './server/server.component';
import { WatcherComponent } from './watcher/watcher.component';
import { DashboardLayoutComponent } from './dashboard-layout/dashboard-layout.component';


const routes: Routes = [
  // { path: '', children: [] },
  { path: '', component: LandingComponent},
  // { path: 'landing', component: LandingComponent},
  { path: 'requestor', component: RequestorComponent },
  { path: 'server', component: ServerComponent },
  { path: 'watcher', component: WatcherComponent },
  { path: 'dashboard', component: DashboardLayoutComponent },
  { path: 'admin', component: AdminLayoutComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
