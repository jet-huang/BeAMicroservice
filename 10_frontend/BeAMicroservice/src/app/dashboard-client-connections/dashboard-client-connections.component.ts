import { ClientConnection } from './../models/game-models';
import { Component, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { AccessSolacePSPService } from './../services/access-solace-psp.service';
import { LoadConfigService } from 'src/app/services/load-config.service';
import { decodeBinaryText, getAppTypeByClientName, getSolaceClientIpByConnectLog, getSolaceClientNameByTopic } from '../services/common-functions.service';
import { GameParameters, AggregatedStats } from '../models/game-models';
import { AccessApiService } from '../services/access-api.service';
import {
  // Trigger is imported here
  trigger,
  state,
  style,
  transition,
  animate } from '@angular/animations';

@Component({
  selector: 'app-dashboard-client-connections',
  templateUrl: './dashboard-client-connections.component.html',
  styleUrls: ['./dashboard-client-connections.component.css'],
  animations: [
    trigger('openClose', [
      state('true', style({ weight: 'bold' })),
      state('false', style({ color: 'red', weight: 'bold' })),
      transition('* => false', [
        style({ color: 'gray', backgroundColor: 'yellow', }),
        animate('1s ease-out', style('*'))
      ])
    ]),
    trigger('valueAnimation', [
      transition(':increment', [
          style({ color: 'red', backgroundColor: 'yellow', }),
          animate('2s ease-out', style('*'))
        ]
      ),
      transition(':decrement', [
          style({ color: 'green', backgroundColor: 'yellow' }),
          animate('2s ease-out', style('*'))
        ]
      )
    ])
  ]
})
export class DashboardClientConnectionsComponent implements OnInit {
  private _topicPrefixLogInfo = "#LOG/INFO/CLIENT";
  private _topicPrefixLogNotice = "#LOG/NOTICE/CLIENT";
  private _topicClientConnectLog = "CLIENT_CLIENT_CONNECT";
  private _topicClientDisconnectLog = "CLIENT_CLIENT_DISCONNECT";
  private _topicClientOpenFlowLog = "CLIENT_CLIENT_OPEN_FLOW";
  private _topicClientCloseFlowLog = "CLIENT_CLIENT_CLOSE_FLOW";
  private _topicClientBindSuccessLog = "CLIENT_CLIENT_BIND_SUCCESS";
  private _topicClientUnbindLog = "CLIENT_CLIENT_UNBIND";
  private _topicClientAllLog = "#LOG/*/CLIENT/*/CLIENT_CLIENT_*/>";
  mClientConnections = new Map<string, ClientConnection>();
  gp?: GameParameters;
  numRequestors = 0;
  numServers = 0;
  numWatchers = 0;

  constructor(private pspService: AccessSolacePSPService,
    private myConfig: LoadConfigService,
    private myApi: AccessApiService,
    private log: NGXLogger) { }

  private addRoleNum(roleId: string): void {
    switch (roleId.substring(0, 2)) {
      case "R-":
        this.numRequestors++;
        break;
      case "S-":
        this.numServers++;
        break;
      case "W-":
        this.numWatchers++;
        break;
    }
  }

  // NOTE: There may be side-effect that the number will be negative
  private delRoleNum(roleId: string): void {
    switch (roleId.substring(0, 2)) {
      case "R-":
        this.numRequestors--;
        break;
      case "S-":
        this.numServers--;
        break;
      case "W-":
        this.numWatchers--;
        break;
    }
  }

  ngOnInit(): void {
    this.myApi.getGameParameters().subscribe(
      (gp) => {
        this.gp = gp;
        this.log.debug(`Game initialized with name: [${this.gp.gameTitle}], servers: [${this.gp.numServers}], watchers: [${this.gp.numWatchers}]`);
      }
    );
    this.pspService.connectStatus$.subscribe(
      (isConnected) => {
        if (isConnected) {
          // Topic template for Solace syslog:
          // "#LOG/INFO/CLIENT/*/CLIENT_CLIENT_CLOSE_FLOW/>"
          /*
          this.pspService.subscribe(this._topicClientConnectLog);
          this.pspService.subscribe(this._topicClientDisconnectLog);
          this.pspService.subscribe(this._topicClientOpenFlowLog);
          this.pspService.subscribe(this._topicClientCloseFlowLog);
          this.pspService.subscribe(this._topicClientBindSuccessLog);
          this.pspService.subscribe(this._topicClientUnbindLog);
          */
          this.pspService.subscribe(this._topicClientAllLog);
          this.log.info(`Dashboard - Client Connections is ready to work`);
        }
      }
    );
    this.pspService.streamDirectMessage().subscribe(
      (message) => {
        const destTopic = message.getDestination().name;
        if (destTopic.startsWith(this._topicPrefixLogInfo) || destTopic.startsWith(this._topicPrefixLogNotice)) {
          const rawData = decodeBinaryText(message.getBinaryAttachment()?.toString());
          this.log.debug(`Received raw data:\n${rawData} from ${destTopic}`);
          const roleId = getSolaceClientNameByTopic(destTopic);
          this.log.debug(`Get roleId: ${roleId} from ${destTopic}`);
          // If we get "CONNECT" event, create an entry
          // SUPER UGLY, but working >_<
          // We only care roleId with specific prefix
          if (roleId.startsWith("R-") || roleId.startsWith("S-") || roleId.startsWith("W-")) {
            if (destTopic.includes(this._topicClientConnectLog)) {
              const ip = getSolaceClientIpByConnectLog(rawData);
              this.mClientConnections.set(roleId, { roleId: roleId, ip: ip, isConnected: true, isOnService: false, updatedOn: (new Date()) });
              this.addRoleNum(roleId);
            } else if (destTopic.includes(this._topicClientDisconnectLog)) {
              if (this.mClientConnections.has(roleId)) {
                const cc = this.mClientConnections.get(roleId)!;
                this.mClientConnections.set(roleId, { roleId: roleId, ip: cc.ip, isConnected: false, isOnService: false, updatedOn: (new Date()) });
                this.delRoleNum(roleId);
              }
            } else if (destTopic.includes(this._topicClientBindSuccessLog)) {
              if (this.mClientConnections.has(roleId)) {
                const cc = this.mClientConnections.get(roleId)!;
                this.mClientConnections.set(roleId, { roleId: roleId, ip: cc.ip, isConnected: true, isOnService: true, updatedOn: (new Date()) });
              }
            } else if (destTopic.includes(this._topicClientUnbindLog)) {
              if (this.mClientConnections.has(roleId)) {
                const cc = this.mClientConnections.get(roleId)!;
                this.mClientConnections.set(roleId, { roleId: roleId, ip: cc.ip, isConnected: true, isOnService: false, updatedOn: (new Date()) });
              }
            }
          }
        }
      }
    )
  }
}
