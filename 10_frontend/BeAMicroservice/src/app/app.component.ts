import { LoadConfigService } from './services/load-config.service';
import { AccessApiService } from './services/access-api.service';
import { NGXLogger } from 'ngx-logger';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor( ) { }
}
