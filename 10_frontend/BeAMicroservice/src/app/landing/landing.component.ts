import { Player } from './../models/game-models';
import { LoadConfigService } from '../services/load-config.service';
import { AccessApiService } from '../services/access-api.service';
import { GameStatusService } from '../services/game-status.service';
import { NGXLogger } from 'ngx-logger';
import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { createPlayerId } from '../services/common-functions.service';
import { throws } from 'assert';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {
  gameTitle = "A COOL DEMO ^_^||";
  isButtonClicked = false;
  isWaiting = false;
  isConnected = false;
  isOnService = false;
  isJoinFailed = false;
  isDebugEnabled = false;
  playerId = "NONE_" + 99999;
  destroy$: Subject<boolean> = new Subject<boolean>();
  isGameRunning = false;
  private _intervalId: any;

  constructor(
    private gameStatus: GameStatusService,
    private router: Router,
    private activeRoute: ActivatedRoute,
    private log: NGXLogger,
    private myApi: AccessApiService,
    private myConfig: LoadConfigService
    ) { }

  private checkGameRunning(): void {
    this.myApi.getGameStatus().subscribe({
      next: (statusDesc) => {
        if (statusDesc == "RUNNING") this.isGameRunning = true;
        else this.isGameRunning = false;
      },
      error: (error) => { this.log.debug(`Cannot get game status due to ${error}`)}
    })
  }

  onMyButtonClick01(): void {
    this.isButtonClicked = true;
    this.router.navigateByUrl('requestor');
  }

  onMyButtonClick02(): void {
    this.isButtonClicked = true;
    this.router.navigateByUrl('server');
  }

  onMyButtonClick03(): void {
    this.isButtonClicked = true;
    this.router.navigateByUrl('watcher');
  }

  onJoinButtonClick(): void {
    this.isButtonClicked = true;
    this.playerId = createPlayerId();
    this.myApi.occupyRole(this.playerId).subscribe({
      next: (player) => {
        this.log.info(`Successfully occupied a role with played ID: ${this.playerId} with role name: ${player.name}`);
        this.log.debug(player);
        this.gameStatus.activePlayer = player;
        this.router.navigate([player.roleTypeDesc.toLowerCase()], {
          queryParams: {
            roleId: player.roleId
          }
         });
         clearInterval(this._intervalId);
      },
      error: (error) => {
        this.isJoinFailed = true;
        this.log.error(error);
      }
    });
  }

  ngOnInit(): void {
    this.isJoinFailed = false;
    this.activeRoute.queryParams.subscribe((queryParams) => {
      this.isDebugEnabled = queryParams['debug'] == 'yes'? true:false;
      this.log.debug(`Debug mode: ${this.isDebugEnabled}`);
    });
    this.myApi.getGameParameters().subscribe(
      (gp) => {
        this.gameTitle = gp.gameTitle;
        this.gameStatus.gameParameters = gp;
        this.log.debug(`Game initialized with: ${JSON.stringify(this.gameStatus.gameParameters)}`);
      }
    );
    this._intervalId = setInterval(() => this.checkGameRunning(), 3000);
  }
}
