import { stat } from 'fs';
import { Component, OnInit } from '@angular/core';
import { MessageEnvelope, SolaceMessageClient, SolaceMessageClientConfig } from '@solace-community/angular-solace-message-client';
import { Observable, from, delay, Subject, takeUntil, Subscription } from 'rxjs';
import { NGXLogger } from 'ngx-logger';
import opentelemetry, { Span, propagation, context, SpanKind, Context, SpanStatusCode } from '@opentelemetry/api';
import {
  // Trigger is imported here
  trigger,
  state,
  style,
  transition,
  animate } from '@angular/animations';
import {
  Message, MessageConsumerAcknowledgeMode,
  QueueDescriptor, QueueType,
  SDTMapContainer, SDTFieldType,
  SolclientFactory
} from 'solclientjs';
import { roundedBy, decodeBinaryText } from '../services/common-functions.service';
import { environment } from 'src/environments/environment';
import { AccessSolacePSPService } from '../services/access-solace-psp.service';
import { LoadConfigService } from '../services/load-config.service';
import { AccessApiService } from '../services/access-api.service';
import { GameParameters, AggregatedStats } from '../models/game-models';
@Component({
  selector: 'app-dashboard-summary',
  templateUrl: './dashboard-summary.component.html',
  styleUrls: ['./dashboard-summary.component.css'],
  animations: [
    trigger('openClose', [
      state('true', style({ color: 'green' })),
      state('false', style({ color: 'red' })),
      transition('false <=> true', [
        style({ color: 'gray', backgroundColor: 'yellow', }),
        animate('3s ease-out', style('*'))
      ])
    ]),
    trigger('valueAnimation', [
      transition(':increment', [
          style({ color: 'navy', backgroundColor: 'yellow', }),
          animate('1.8s ease-out', style('*'))
        ]
      ),
      transition(':decrement', [
          style({ color: 'green', backgroundColor: 'yellow' }),
          animate('1.8s ease-out', style('*'))
        ]
      )
    ])
  ]
})
export class DashboardSummaryComponent implements OnInit {
  clientNamePrefix = "DASHBOARD-";
  gp?: GameParameters;
  targetTopics = ["#LOG/INFO/CLIENT/*/CLIENT_CLIENT_*/>"];
  targetQueues = ["q1", "q"];
  private readonly _playersStatsTopic = "players/elided/aggregatedStats";
  currStats: AggregatedStats = {
    totalEvents: 0,
    successEvents: 0,
    failedEvents: 0,
    totalVolume: 0,
    avgVolume: 0,
    avgRate: 0.0,
    updatedAt: (new Date()),
    receivedAt: (new Date()),
    timediff: 0
  }

  constructor(
    private psp: SolaceMessageClient,
    private pspService: AccessSolacePSPService,
    private myApi: AccessApiService,
    private log: NGXLogger
  ) { }

  ngOnInit(): void {
    /*
    this.pspService.streamDirectMessage().subscribe(
      msg => this.log.debug(`Received: ${msg.getDestination()}`)
    );
    */
    this.myApi.getGameParameters().subscribe(
      (gp) => {
        this.gp = gp;
        this.log.debug(`Game initialized with name: [${this.gp.gameTitle}], servers: [${this.gp.numServers}], watchers: [${this.gp.numWatchers}]`);
      }
    )
    this.pspService.streamDirectMessage().subscribe(
      (message) => {
        if (message.getDestination().name == this._playersStatsTopic) {
          const rawData = decodeBinaryText(message.getBinaryAttachment()?.toString());
          this.currStats = JSON.parse(rawData) as AggregatedStats;
        }
      }
    )
  }
}
