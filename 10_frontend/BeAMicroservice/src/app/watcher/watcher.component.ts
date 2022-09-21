import { LoadConfigService } from './../services/load-config.service';
import { ActivatedRoute } from '@angular/router';
import { OtelTraceService } from './../services/otel-trace.service';
import { Component, OnInit } from '@angular/core';
import { MessageEnvelope, SolaceMessageClient, SolaceMessageClientConfig } from '@solace-community/angular-solace-message-client';
import { Observable, from, delay, Subject, takeUntil, Subscription } from 'rxjs';
import { NGXLogger } from 'ngx-logger';
import opentelemetry, { Span, propagation, context, SpanKind, Context, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  Message, MessageConsumerAcknowledgeMode,
  QueueDescriptor, QueueType,
  SDTMapContainer, SDTFieldType,
  SolclientFactory, MessageDeliveryModeType
} from 'solclientjs';

import { cloneSolaceMessage, createSolaceConnectionUrl, createSolaceSessionClientName, decodeBinaryText } from '../services/common-functions.service';
import { environment } from 'src/environments/environment';
import { RequestMessage } from '../models/request-message';
import { RequestStatus } from '../models/enum-request-status';
import { AccessApiService } from '../services/access-api.service';
import { GameStatusService } from '../services/game-status.service';
import { GameParameters } from 'src/app/models/game-models';

@Component({
  selector: 'app-watcher',
  templateUrl: './watcher.component.html',
  styleUrls: ['./watcher.component.css']
})
export class WatcherComponent implements OnInit {
  isWaiting = false;
  isConnected = false;
  isOnService = false;
  playerIdPrefix = "W";
  playerId = this.playerIdPrefix + 99999;
  destroy$: Subject<boolean> = new Subject<boolean>();
  mRequests = new Map<string, RequestMessage>();
  private _seqNum = 0;
  private _sessionConfig!: SolaceMessageClientConfig;
  private _subscription: Subscription | null = null;
  private mMessages = new Map<string, Message>();
  private mSpans = new Map<string, Span>();
  private _tracer = this.ots.getTracer(`${this.myConfig.runtimeConfig.serviceName}_WATCHER`);

  constructor(
    public gameStatus: GameStatusService,
    private myApi: AccessApiService,
    private psp: SolaceMessageClient, private log: NGXLogger,
    private route: ActivatedRoute, private ots: OtelTraceService,
    private myConfig: LoadConfigService){

    }

  private init(): void {
    this.mMessages.clear();
    this.mRequests.clear();
    this.mSpans.clear();
    this._sessionConfig = {
      url: createSolaceConnectionUrl(
        this.myConfig.runtimeConfig.solace.protocol,
        this.myConfig.runtimeConfig.solace.host,
        this.myConfig.runtimeConfig.solace.port
        ),
      vpnName: environment.solace.vpnName,
      userName: environment.solace.userName,
      password: environment.solace.password,
      clientName: this.playerId
    }
  }

  getRequestMessage(msg: Message): RequestMessage {
    const currRequest: RequestMessage = JSON.parse(decodeBinaryText(msg.getBinaryAttachment()?.toString()));
    return currRequest;
  }

  onConnectSwitchChanged(): void {
    this.init();
    if (!this.isConnected) {
      this.log.info(`Connecting to ${this._sessionConfig.url}`);
      this.isWaiting = true;
      const pspStatus$ = from(this.psp.connect(this._sessionConfig));
      pspStatus$.pipe(delay(333)).subscribe({
        next: () => {
          this.isOnService = false;
          this.isConnected = true;
          this.isWaiting = false;
          this.log.info(`connected to PS+ with client-name: ${this._sessionConfig.clientName}`)
        },
        error: (error) => this.log.error(`failed while connecting to ${this._sessionConfig.url}`, error)
      })
    } else {
      this.isWaiting = true;
      this.psp.disconnect().then(
        () => {
          this.isOnService = false;
          this.isConnected = false;
          this.isWaiting = false;
          this.log.info(`${this._sessionConfig.clientName} has disconnected from ${this._sessionConfig.url}`)
        },
        error => this.log.error(`failed while disconnecting from ${this._sessionConfig.url}`, error)
      )
    }
  }

  onService(): void {
    this.init();
    if (!this.isOnService) {
      const consumer$: Observable<MessageEnvelope> = this.psp.consume$({
        acknowledgeMode: MessageConsumerAcknowledgeMode.CLIENT,
        queueDescriptor: new QueueDescriptor({ type: QueueType.QUEUE, name: 'q-watcher' }),
        // @ts-expect-error: typedef(solclientjs): remove 'queueProperties' when changed 'queueProperties' to optional
        queueProperties: undefined,
      });
      this._subscription = consumer$.pipe(
        takeUntil(this.destroy$),
      ).subscribe({
        next: (envelope: MessageEnvelope) => {
          const msg = envelope.message;
          const currItem = decodeBinaryText(msg.getBinaryAttachment()?.toString());
          const currRequest: RequestMessage = Object.assign(new RequestMessage("tmp", 99999), JSON.parse(currItem));
          const currDestination = msg.getDestination().name;
          this.log.debug("Received message: ", currItem);
          currRequest.setStatus(RequestStatus.pending);
          this.mMessages.set(currRequest.id, msg);
          this.mRequests.set(currRequest.id, currRequest);
          // extract otelCarrier
          const mySDT = envelope.message.getUserPropertyMap();
          if (mySDT != null) {
            // tracing
            this.log.debug(`otelCarrier after extracting: ${JSON.stringify(mySDT?.getField("otelCarrier").getValue())}`);
            const sourceContext = propagation.extract(context.active(), JSON.parse(mySDT?.getField("otelCarrier").getValue()));
            const currSpan = this._tracer.startSpan(this.onService.name, { kind: SpanKind.CONSUMER }, sourceContext);
            currSpan.setAttribute("requestId", `${msg.getSenderId()}|${msg.getCorrelationId()}`);
            currSpan.setAttribute("senderId", `${msg.getSenderId()}`);
            currSpan.setAttribute("serverId", `${this._sessionConfig.clientName}`);
            this.mSpans.set(currRequest.id, currSpan);
            // tracing-end
          }
        },
        error: error => { this.log.error("Error while receiving message: ", error); }
      })
      this.isOnService = true;
    } else {
      this._subscription?.unsubscribe();
      this._subscription = null;
      this.isOnService = false;
    }
  }

  onAckClick(reqId: string): void {
    // tracing
    const currSpan = this.mSpans.get(reqId)!;
    const traceId = currSpan.spanContext().traceId;
    // tracing-end
    this._seqNum++;
    const currMsg = this.mMessages.get(reqId)!;
    const currRequest: RequestMessage = Object.assign(new RequestMessage("tmp", 99999), JSON.parse(currMsg.getBinaryAttachment()!.toString()));
    // Dirty but at least work
    this.mRequests.get(currRequest.id)?.setStatus(RequestStatus.waiting);
    this._tracer.startActiveSpan(this.onAckClick.name, { kind: SpanKind.INTERNAL }, opentelemetry.trace.setSpan(context.active(), currSpan) , mySpan => {
      this.log.debug(`Successfully processed request: ${currRequest.id}`);
      currRequest.receiverId = this.playerId;
      currRequest.receiverProcessId = `${currRequest.receiverId}__${this._seqNum}`;
      // Publish result to aggregator
      mySpan.addEvent("Publish to aggregator");
      const repMsg = cloneSolaceMessage(currMsg);
      repMsg.setDeliveryMode(MessageDeliveryModeType.DIRECT);
      let mySDT = currMsg.getUserPropertyMap()!;
      // tracing
      mySpan.setAttribute("receiverProcessId", `${currRequest.receiverProcessId}`);
      mySpan.setAttribute("receiverId", `${currRequest.receiverId}`);
      let otelCarrier = { data: null, traceId: mySpan.spanContext().traceId};
      propagation.inject(trace.setSpan(context.active(), mySpan), otelCarrier);
      this.log.debug(`otelCarrier after injecting: ${JSON.stringify(mySDT.getField("otelCarrier").getValue())}`);
      mySDT.addField("otelCarrier", SDTFieldType.STRING, JSON.stringify(otelCarrier));
      // tracing-end
      repMsg.setUserPropertyMap(mySDT);
      repMsg.setSenderId(this._sessionConfig.clientName!);
      repMsg.setBinaryAttachment(JSON.stringify(currRequest));
      // Send to aggregator first, otherwise the repMsg may be set by reply function
      this.psp.publish(`reply/watcher/${this._sessionConfig.clientName}`, repMsg);
      mySpan.addEvent("Post processing");
      if (this.mMessages.has(reqId)) {
        this.mMessages.get(reqId)?.acknowledge();
        this.mRequests.get(reqId)?.setStatus(RequestStatus.success);
        // this.lMessages.splice(msgIndex, 1);
        this.mRequests.delete(reqId);
        this.mMessages.delete(reqId);
      }
      this.mSpans.delete(reqId);
      mySpan.addEvent(RequestStatus[RequestStatus.success]);
      mySpan.setStatus({ code: SpanStatusCode.OK });
      mySpan.end();
      currSpan.end();
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((queryParams) => {
      this.playerId = queryParams['roleId'] ?? createSolaceSessionClientName(`${this.playerIdPrefix}-DEBUG-`);
      this.log.debug(`player id: ${this.playerId}`);
    });
    this.myApi.getGameParameters().subscribe(
      (gp: GameParameters) => {
        this.gameStatus.gameParameters = gp;
        this.log.debug(`Game initialized with: ${JSON.stringify(this.gameStatus.gameParameters)}`);
      }
    );
    this.init();
  }
}
