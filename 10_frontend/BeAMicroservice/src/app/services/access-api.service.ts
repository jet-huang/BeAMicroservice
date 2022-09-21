import { LoadConfigService } from './load-config.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GameParameters, Player } from 'src/app/models/game-models';
import { getPaddingRandomNumer, getRandomNumber } from './common-functions.service';

@Injectable({
  providedIn: 'root'
})
export class AccessApiService {
  private apiBaseUrl: string;
  private readonly apiGameMaker = "api/GameMaker/v1";

  constructor(private http: HttpClient, private myConfig: LoadConfigService) {
    this.apiBaseUrl = this.myConfig.runtimeConfig.apiBaseUrl;
  }

  private getApiUrl(apiName: string, apiResource: string) {
    return `${this.apiBaseUrl}/${apiName}/${apiResource}`;
  }

  public getRandomDataRemotely() {
    const MAX_CITY_ID = 13;  // After 13, there is missing number in SKBank api.
    const cityId = getPaddingRandomNumer(1, MAX_CITY_ID, 2);
    const apiRequestStrings = ["api/PhysicalBank/", "api/PhysicalBank/branch/", "api/PhysicalBank/atm/"];
    const apiRequestString = apiRequestStrings[Math.floor(Math.random()*apiRequestStrings.length)];
    const apiUrl = this.apiBaseUrl + "/" + apiRequestString;

    return this.http.get(`${apiUrl}${cityId}`);
  }

  public getPhysicalBankServices(cityId: string) {
    const apiRequestString = "api/PhysicalBank/";
    const apiUrl = this.apiBaseUrl + "/" + apiRequestString;

    return this.http.get(`${apiUrl}${cityId}`);
  }

  public getGameParameters() {
    const apiResource = "game/parameters";
    const apiUrl = this.getApiUrl(this.apiGameMaker, apiResource);
    const options = {}

    return this.http.get<GameParameters>(`${apiUrl}`);
  }

  public getGameStatus() {
    const apiResource = "game/status";
    const apiUrl = this.getApiUrl(this.apiGameMaker, apiResource);
    const options = {}

    return this.http.get<string>(`${apiUrl}`);
  }

  public changeGameStatus(statusDesc: string) {
    // Refer to Will, to post "string" type to backend, we need to do some pre-tasks.
    const apiResource = "game/status";
    const apiUrl = this.getApiUrl(this.apiGameMaker, apiResource);
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'text/json'
      })
    }
    const body = JSON.stringify(statusDesc);

    return this.http.patch<any>(`${apiUrl}`, body, options);
  }


  public initGame(gp: GameParameters) {
    const apiResource = "game";
    const apiUrl = this.getApiUrl(this.apiGameMaker, apiResource);
    const options = {}
    const body = gp;

    return this.http.post<GameParameters>(`${apiUrl}`, body, options);
  }

  public getOccupiedRoles() {
    const apiResource = "roles";
    const apiUrl = this.getApiUrl(this.apiGameMaker, apiResource);
    const options = {}

    return this.http.get<Player[]>(`${apiUrl}`);
  }

  public getAvailableRoles() {
    const apiResource = "availableRoles";
    const apiUrl = this.getApiUrl(this.apiGameMaker, apiResource);
    const options = {}

    return this.http.get<Player[]>(`${apiUrl}`);
  }

  public testOccupyRole(id: string) {
    // Refer to Will, to post "string" type to backend, we need to do some pre-tasks.
    const apiResource = "role";
    const apiUrl = this.getApiUrl(this.apiGameMaker, apiResource);
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'text/json'
      })
    }
    const body = JSON.stringify(id);

    return this.http.post<string>(`${apiUrl}`, body, options);
  }


  public occupyRole(id: string) {
    // Refer to Will, to post "string" type to backend, we need to do some pre-tasks.
    const apiResource = "role";
    const apiUrl = this.getApiUrl(this.apiGameMaker, apiResource);
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'text/json'
      })
    }
    const body = JSON.stringify(id);

    return this.http.post<Player>(`${apiUrl}`, body, options);
  }
}
