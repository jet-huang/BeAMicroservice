import { Component, OnInit } from '@angular/core';
import { Player } from 'src/app/models/game-models';
import { GameStatusService } from 'src/app/services/game-status.service';
import { LoadConfigService } from 'src/app/services/load-config.service';
import { NGXLogger } from 'ngx-logger';

@Component({
  selector: 'app-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.css']
})
export class DataListComponent implements OnInit {
  occupiedPlayers: Player[] = [];
  availablePlayers: Player[] = [];

  constructor(private gameStatus: GameStatusService,
    private myConfig: LoadConfigService,
    private log: NGXLogger
    ) { }

  private updateList(): void {
    this.occupiedPlayers = this.gameStatus.occupiedPlayers;
    this.availablePlayers = this.gameStatus.availablePlayers;
  }

  getTracingLink(player: Player): string {
    const urlPrefix = `${this.myConfig.runtimeConfig.jaegerBaseUrl}/search?limit=8&lookback=1h`
    // Not a good way, but it just works.
    var serviceName = "";  // service=
    var targetIdTag = "";  // senderId or serverId

    switch(player.rolePrefix) {
      case "R":
        serviceName = this.myConfig.runtimeConfig.serviceName;
        targetIdTag = "senderId";
        break;
      case "S":
        serviceName = `${this.myConfig.runtimeConfig.serviceName}_SERVER`;
        targetIdTag = "serverId";
        break;
      case "W":
        serviceName = `${this.myConfig.runtimeConfig.serviceName}_WATCHER`;
        targetIdTag = "serverId";
        break;
      default:
        break;
    }
    const generatedUrl = `${urlPrefix}&service=${serviceName}&tags=%7B%22${targetIdTag}%22%3A%22${player.roleId}%22%7D`;
    this.log.debug(`Generated url for ${player.roleId} as ${generatedUrl}`);
    return generatedUrl;
  }

  ngOnInit(): void {
    // actually not a very elegant way, it makes too much updates!
    this.gameStatus.updateStatus.subscribe(
      () => this.updateList()
    )
  }
}
