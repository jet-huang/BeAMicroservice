import { error } from 'console';
import { AccessApiService } from './../../services/access-api.service';
import { Component, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { LoadConfigService } from 'src/app/services/load-config.service';
import { GameParameters, Player } from 'src/app/models/game-models';
import { createPlayerId } from 'src/app/services/common-functions.service';
import { GameStatusService } from 'src/app/services/game-status.service';

@Component({
  selector: 'app-control-pad',
  templateUrl: './control-pad.component.html',
  styleUrls: ['./control-pad.component.css']
})
export class ControlPadComponent implements OnInit {
  gp: GameParameters = {
    gameTitle: "Be A Microservice",
    numServers: 1,
    numWatchers: 1,
    nameRequestor: "REQUESTOR",
    nameServer: "SERVER",
    nameWatcher: "WATCHER",
    buttonTextRequestor: "Send Request",
    buttonTextServer: "ACK",
    buttonTextWatcher: "Notify"
  }
  isGameRunning = false;

  constructor(private log: NGXLogger,
    private myConfig: LoadConfigService,
    private api: AccessApiService,
    private gameStatus: GameStatusService
    ) { }

  private listPlayerRoles(players: Player[]): void {
    if (players.length === 0) {
      this.log.warn(`No players there...`);
    } else {
      this.log.debug(`There are ${players.length} players/roles`)
      players.forEach((value, index) => {
        this.log.debug(`Player name: ${value.name}, id: ${value.id}`)
        this.log.debug(`Dump: ${JSON.stringify(value)}`);
      })
    }
  }

  updatePlayersList(): void {
    this.getAvailablePlayers();
    this.getOccupiedPlayers();
  }

  getOccupiedPlayers(): void {
    this.api.getOccupiedRoles().subscribe({
      next: (res) => {
        this.gameStatus.occupiedPlayers = res;
        this.gameStatus.updateStatus.next(true);
        this.listPlayerRoles(this.gameStatus.occupiedPlayers);
      },
      error: (error) => this.log.error(error)
    })
  }

  getAvailablePlayers(): void {
    this.api.getAvailableRoles().subscribe({
      next: (res) => {
        this.gameStatus.availablePlayers = res;
        this.gameStatus.updateStatus.next(true);
        this.listPlayerRoles(this.gameStatus.availablePlayers);
      },
      error: (error) => this.log.error(error)
    })
  }

  onInitGameClick(): void {
    this.log.debug(`Initializing the game with name: ${this.gp.gameTitle}, servers: ${this.gp.numServers}, watchers: ${this.gp.numWatchers}`);
    this.api.initGame(this.gp).subscribe({
      next: (res) => {
        // update gameStatus
        this.updatePlayersList();
        this.api.getGameParameters().subscribe({
          next: (gp) => {
            this.log.info(`Game initialized with ${JSON.stringify(gp)}`);
          }
        });
        // Stop the game
        this.api.changeGameStatus("STOPPED").subscribe({
          next: () => {
            this.isGameRunning = false;
            this.log.info(`Game status has been changed to STOPPED.`)
          },
          error: (error) => this.log.error(`Failed while changing game status to STOPPED, error: ${error}`)
        });
      },
      error: (error) => this.log.error(error)
    });
  }

  onOccupiedRolesClick(): void {
    this.api.getOccupiedRoles().subscribe({
      next: (res) => {
        this.gameStatus.occupiedPlayers = res;
        this.gameStatus.updateStatus.next(true);
        this.listPlayerRoles(this.gameStatus.occupiedPlayers);
      },
      error: (error) => this.log.error(error)
    })
  }

  onAvailableRolesClick(): void {
    this.api.getAvailableRoles().subscribe({
      next: (res) => {
        this.gameStatus.availablePlayers = res;
        this.gameStatus.updateStatus.next(true);
        this.listPlayerRoles(this.gameStatus.availablePlayers);
      },
      error: (error) => this.log.error(error)
    })
  }

  onTestOccupyRoleClick(): void {
    const id = createPlayerId();
    this.api.testOccupyRole(id).subscribe({
      next: () => {
        this.log.info(`Successfully occupied with ${id}`);
        // update gameStatus
        this.updatePlayersList();
      },
      error: (error) => this.log.error(error)
    })
  }

  onGameStatusChange(): void {
    if (!this.isGameRunning) {
      this.api.changeGameStatus("RUNNING").subscribe({
        next: () => {
          this.isGameRunning = true;
          this.log.info(`Game status has been changed to RUNNING.`)
        },
        error: (error) => this.log.error(`Failed while changing game status to RUNNING, error: ${error}`)
      })
    } else {
      this.api.changeGameStatus("STOPPED").subscribe({
        next: () => {
          this.isGameRunning = false;
          this.log.info(`Game status has been changed to STOPPED.`)
        },
        error: (error) => this.log.error(`Failed while changing game status to STOPPED, error: ${error}`)
      })
    }
  }

  ngOnInit(): void {
    // Update the list for first time
    this.updatePlayersList();
  }

}
