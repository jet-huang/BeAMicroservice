import { AccessSolacePSPService } from './../services/access-solace-psp.service';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { LoadConfigService } from './../services/load-config.service';
import { ActivatedRoute } from '@angular/router';
import { OtelTraceService } from './../services/otel-trace.service';
import { MessageEnvelope, SolaceMessageClient, SolaceMessageClientConfig } from '@solace-community/angular-solace-message-client';
import { Observable, from, first, delay, Subject, takeUntil, Subscription, BehaviorSubject } from 'rxjs';
import { NGXLogger } from 'ngx-logger';
import opentelemetry, { Span, propagation, context, SpanKind, Context, SpanStatusCode } from '@opentelemetry/api';
import {
  Message, MessageConsumerAcknowledgeMode,
  QueueDescriptor, QueueType,
  SDTMapContainer, SDTFieldType,
  SolclientFactory,
  SessionEventCode
} from 'solclientjs';

import { createSolaceConnectionUrl, createSolaceSessionClientName, decodeBinaryText, getAppTypeByClientName, getSolaceClientNameByTopic } from '../services/common-functions.service';
import { environment } from 'src/environments/environment';
import { OnlineClient } from '../models/online-client';

@Component({
  selector: 'app-pspswitch',
  templateUrl: './pspswitch.component.html',
  styleUrls: ['./pspswitch.component.css']
})

export class PSPSwitchComponent implements OnInit {
  @Input() clientNamePrefix: string = "";
  @Input() targetTopics: string[] = [];
  @Input() targetQueues: string[] = [];
  private _clientName!: string;
  private _targetQueue = "q1";
  private _directMessage$: Observable<Message> = new Observable<Message>();
  private _guaranteedMessage$: Observable<Message> = new Observable<Message>();
  private _directMessageStream$!: Subscription;
  private _guaranteedMessageStream$!: Subscription;
  onlineClientsList = new Array<OnlineClient>();
  isWaiting = false;
  isConnected = false;
  isOnService = false;

  constructor(
    private psp: SolaceMessageClient,
    private pspService: AccessSolacePSPService,
    private log: NGXLogger,
    private myConfig: LoadConfigService
  ) { }

  private init(): void {
    this.isConnected = false;
    this.isOnService = false;
    this.isWaiting = false;
  }

  private test(): void {
    this.pspService.subscribe("_CMD_");
    // this.pspService.subscribe("my/topic/>");
    /*
    this.pspService.currentMessage$.subscribe({
      next: (message) => {
        this.log.debug(message.dump());
      }
    });
    */
    // this.pspService.solclientSession.on(SessionEventCode.MESSAGE, this.myMessageProcessor);
  }

  public test2(): void {
    this.pspService.unsubscribeAll();
    // this.pspService.unsubscribe("_CMD_");
    // this.pspService.unsubscribe("my/topic/>");
    this.log.debug("CLICKED test2!!");
  }

  private myMessageProcessor(message: Message): void {
    this.log.debug(message.dump());
    this.log.debug(`Getting message from ${message.getDestination().name}`);
    this.log.debug(`Getting message: ${message.getBinaryAttachment()?.toString()}`);
  }

  onConnectSwitchChanged(): void {
    this.isWaiting = true;
    if (!this.pspService.isConnected) {
      this.pspService.connect();
    } else {
      this.pspService.disconnect();
    }
    this.pspService.connectStatus$.pipe(first(), delay(333)).subscribe({
      next: (isConnected) => {
        this.isConnected = isConnected;
        if (isConnected) {
          this.isWaiting = false;
          this.test();
        } else {
          this.init();
        }
      }
    })
  }

  onService(): void {
    this.isWaiting = true;
    if (!this.isOnService && this.isConnected) {
      this.targetTopics.forEach((value, index) => {
        this.pspService.subscribe(value);
      });
      /*
      this._directMessageStream$ = this.pspService.streamDirectMessage().subscribe({
        next: (message) => {
          // this.log.debug(`Got direct message: ${message.dump()}`);
          this.log.debug(`Direct message to: ${message.getDestination()}`);
          this.log.debug(`Direct message says: ${message.getBinaryAttachment()}`);
          if (message.getDestination().name.includes("CLIENT_CLIENT_CONNECT")) {
            this.onlineClientsList.push({
              clientName: getSolaceClientNameByTopic(message.getDestination().name),
              isConnected: true,
              isOnService: false,
              receivedCount: 0,
              processedCount: 0,
              timedout: 0.0,
              appType: getAppTypeByClientName(getSolaceClientNameByTopic(message.getDestination().name))
            })
            this.onlineClientsList.forEach((value, index) => {
              this.log.debug(`${value.clientName}`);
            })
          }
        }
      })
      */
      this.targetQueues.forEach((value, index) => {
        this.pspService.bind(value);
      })
      /*
      this._guaranteedMessageStream$ = this.pspService.streamGuaranteedMessage().subscribe({
        next: (message) => {
          message.acknowledge();
          this.log.debug(`Got guaranteed message: ${message.dump()}`);
        }
      })
      */
      this.isOnService = true;
    } else {
      this.pspService.unsubscribeAll();
      this._directMessageStream$.unsubscribe();
      this.pspService.unbindAll();
      this._guaranteedMessageStream$.unsubscribe();
      this.isOnService = false;
    }
    this.isWaiting = false;
  }

  ngOnInit(): void {
    this.init();
    this.clientNamePrefix = this.clientNamePrefix.length <= 0?"PSPSWITCH-DEFAULT":this.clientNamePrefix;
    this.pspService.clientName = createSolaceSessionClientName(this.clientNamePrefix);
  }

}
