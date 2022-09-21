import { LoadConfigService } from 'src/app/services/load-config.service';
import { Player, PlayerRecord } from 'src/app/models/game-models';
import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { NGXLogger } from 'ngx-logger';
import {
  // Trigger is imported here
  trigger,
  state,
  style,
  transition,
  animate
} from '@angular/animations';

import { OnlineClient } from '../models/online-client';
import { createSolaceConnectionUrl, createSolaceSessionClientName, decodeBinaryText, getAppTypeByClientName, getSolaceClientNameByTopic } from '../services/common-functions.service';
import { AccessSolacePSPService } from './../services/access-solace-psp.service';

@Component({
  selector: 'app-dashboard-online-clients',
  templateUrl: './dashboard-online-clients.component.html',
  styleUrls: ['./dashboard-online-clients.component.css'],
  animations: [
    trigger('valueAnimation', [
      transition(':increment', [
        style({ color: 'green', backgroundColor: 'yellow', }),
        animate('1.8s ease-out', style('*'))
      ]
      ),
      transition(':decrement', [
        style({ color: 'blue', backgroundColor: 'yellow' }),
        animate('1.8s ease-out', style('*'))
      ]
      )
    ])
  ]
})
export class DashboardOnlineClientsComponent implements OnInit {
  private _directMessageStream$!: Subscription;
  private _guaranteedMessageStream$!: Subscription;
  private readonly _playersStatsTopic = "players/stats/>";
  onlineClientsList = new Array<OnlineClient>();
  playersStats = new Map<string, PlayerRecord>();

  constructor(private pspService: AccessSolacePSPService,
    private myConfig: LoadConfigService,
    private log: NGXLogger
  ) { }

  private getBaseTracingLink(playerId: string): string {
    const urlPrefix = `${this.myConfig.runtimeConfig.jaegerBaseUrl}/search?limit=8&lookback=1h`
    // Not a good way, but it just works.
    var serviceName = "";  // service=
    var targetIdTag = "";  // senderId or serverId

    switch(playerId.charAt(0)) {
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

    return `${urlPrefix}&service=${serviceName}&tags=%7B%22${targetIdTag}%22%3A%22${playerId}%22`;
  }

  getTracingLink(playerId: string): string {
    const generatedUrl = `${this.getBaseTracingLink(playerId)}%7D`;
    // this.log.debug(`Generated url for ${playerId} as ${generatedUrl}`);
    return generatedUrl;
  }

  getFailedTracingLink(playerId: string): string {
    const generatedUrl = `${this.getBaseTracingLink(playerId)}%2C"error"%3A"true"%7D`;
    // this.log.debug(`Generated url for ${playerId} as ${generatedUrl}`);
    return generatedUrl;
  }

  ngOnInit(): void {
    this.pspService.connectStatus$.subscribe(
      (isConnected) => {
        if (isConnected) {
          this.pspService.subscribe(this._playersStatsTopic);
          this.log.info(`Dashboard - Online Clients is ready to work`);
        }
      }
    )
    this.pspService.streamDirectMessage().subscribe(
      (message) => {
        if (message.getDestination().name.startsWith(this._playersStatsTopic.substring(0, this._playersStatsTopic.length-3))) {
          const rawData = decodeBinaryText(message.getBinaryAttachment()?.toString());
          // this.log.debug(`Received raw data:\n${rawData} from ${message.getDestination().name}`);
          const playerId = (message.getDestination().name).split("/").pop()!;
          this.playersStats.set(playerId, JSON.parse(rawData) as PlayerRecord);
        }
      }
    )
  }

}
