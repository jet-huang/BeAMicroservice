import { AggregatedStats } from './../models/game-models';
import { Component, OnInit } from '@angular/core';
import { AccessSolacePSPService } from '../services/access-solace-psp.service';
import { LoadConfigService } from '../services/load-config.service';
import { NGXLogger } from 'ngx-logger';
import { decodeBinaryText, roundedBy } from '../services/common-functions.service';

@Component({
  selector: 'app-dashboard-delayed',
  templateUrl: './dashboard-delayed.component.html',
  styleUrls: ['./dashboard-delayed.component.css']
})
export class DashboardDelayedComponent implements OnInit {
  private readonly _playersStatsTopic = "players/aggregatedStats";
  private readonly _playersStatsQueue = "q-dashboard-delayed";
  receivedMessages: AggregatedStats[] = [];

  constructor(
    private pspService: AccessSolacePSPService,
    private myConfig: LoadConfigService,
    private log: NGXLogger
  ) { }

  ngOnInit(): void {
    this.pspService.connectStatus$.subscribe(
      (isConnected) => {
        if (isConnected) {
          // this.pspService.subscribe(this._playersStatsTopic);
          this.pspService.bind(this._playersStatsQueue);
          this.log.info(`Dashboard - Delayed is ready to work`);
        }
      }
    )
    this.pspService.streamGuaranteedMessage().subscribe(
      (message) => {
        if (message.getDestination().name == this._playersStatsTopic) {
          const rawData = decodeBinaryText(message.getBinaryAttachment()?.toString());
          const currStats = JSON.parse(rawData) as AggregatedStats;
          // Cast string to Date type otherwise there will be a runtime error
          currStats.receivedAt = new Date();
          currStats.updatedAt = new Date(currStats.updatedAt);
          currStats.timediff = roundedBy((currStats.receivedAt.getTime() - currStats.updatedAt.getTime()) / 1000, 2);
          this.receivedMessages.push(currStats);
          message.acknowledge();
        }
      }
    )
  }
}
