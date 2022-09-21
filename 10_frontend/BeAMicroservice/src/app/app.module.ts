import { AdminModule } from './admin/admin.module';
import { HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { SolaceMessageClientModule } from '@solace-community/angular-solace-message-client';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';

import { environment } from 'src/environments/environment';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { RequestorComponent } from './requestor/requestor.component';
import { ServerComponent } from './server/server.component';
import { WatcherComponent } from './watcher/watcher.component';
import { LoadConfigService } from './services/load-config.service';
import { DashboardLayoutComponent } from './dashboard-layout/dashboard-layout.component';
import { DashboardRealtimeComponent } from './dashboard-realtime/dashboard-realtime.component';
import { DashboardOnlineClientsComponent } from './dashboard-online-clients/dashboard-online-clients.component';
import { DashboardSummaryComponent } from './dashboard-summary/dashboard-summary.component';
import { DashboardDelayedComponent } from './dashboard-delayed/dashboard-delayed.component';
import { DashboardElidedComponent } from './dashboard-elided/dashboard-elided.component';
import { PSPSwitchComponent } from './pspswitch/pspswitch.component';
import { SharedModule } from './shared/shared.module';
import { LandingComponent } from './landing/landing.component';
import { DashboardClientConnectionsComponent } from './dashboard-client-connections/dashboard-client-connections.component';

const logLevel: any = environment.logger.level;

@NgModule({
  declarations: [
    AppComponent,
    RequestorComponent,
    ServerComponent,
    WatcherComponent,
    DashboardLayoutComponent,
    DashboardRealtimeComponent,
    DashboardOnlineClientsComponent,
    DashboardSummaryComponent,
    DashboardDelayedComponent,
    DashboardElidedComponent,
    PSPSwitchComponent,
    LandingComponent,
    DashboardClientConnectionsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    SharedModule,
    AdminModule,
    SolaceMessageClientModule.forRoot(),
    LoggerModule.forRoot({
      level: NgxLoggerLevel[logLevel]
    } as any)
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (myConfig: LoadConfigService) => () => myConfig.initRuntimeConfig(),
      deps: [LoadConfigService],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
