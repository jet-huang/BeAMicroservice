import { Injectable } from '@angular/core';
import { Observable, Subject, tap, lastValueFrom } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export interface RuntimeConfig {
  apiBaseUrl: string;
  serviceName: string;
  exporterUrl: string;
  jaegerBaseUrl: string;
  demoBy: string;
  solace: {
    protocol: "wss"|"ws"|"https"|"http"
    host: string;
    port: number;
    vpnName: string;
    userName: string;
    password: string;
  }
}

@Injectable({
  providedIn: 'root'
})
export class LoadConfigService {
  public runtimeConfig!: RuntimeConfig;

  constructor(private http: HttpClient) {
  }

  initRuntimeConfig() {
    const configSource = environment.production? "runtimeConfig.prod.json":"runtimeConfig.json";
    console.log(`Loading config from ${configSource}, in production: ${environment.production}`);
    return lastValueFrom(this.http.get<RuntimeConfig>(`./assets/config/${configSource}`)
    .pipe(tap(conf => {
      this.runtimeConfig = conf
      console.log(`Loaded config: ${this.runtimeConfig.apiBaseUrl}`);
    })));
  }
}
