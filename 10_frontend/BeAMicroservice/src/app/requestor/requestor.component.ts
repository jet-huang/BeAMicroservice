import { AccessApiService } from './../services/access-api.service';
import { GameParameters } from 'src/app/models/game-models';
import { LoadConfigService } from './../services/load-config.service';
import { ActivatedRoute } from '@angular/router';
import { SpanKind, propagation, trace, context, SpanStatusCode } from '@opentelemetry/api';
import { OtelTraceService } from './../services/otel-trace.service';
import { SolaceMessageClient, SolaceMessageClientConfig } from '@solace-community/angular-solace-message-client';
import { Component, OnInit } from '@angular/core';
import { NGXLogger } from 'ngx-logger';
import { from, delay } from 'rxjs';
import { createSolaceConnectionUrl, createSolaceSessionClientName, decodeBinaryText, getRandomNumber } from '../services/common-functions.service';
import { environment } from 'src/environments/environment';
import { RequestMessage } from '../models/request-message';
import { RequestStatus } from '../models/enum-request-status';
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
    RequestError, SolclientFactory,
    SDTMapContainer, SDTFieldType
  } from 'solclientjs';
import { GameStatusService } from '../services/game-status.service';

@Component({
  selector: 'app-requestor',
  templateUrl: './requestor.component.html',
  styleUrls: ['./requestor.component.css'],
  animations: [
    trigger('valueAnimation', [
      transition(':increment', [
          style({ color: 'red', backgroundColor: 'yellow', }),
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
export class RequestorComponent implements OnInit {
  isWaiting = false;
  isConnected = false;
  mRequests = new Map<string, RequestMessage>();
  playerIdPrefix = "R";
  playerId = this.playerIdPrefix + 99999;
  reqTimedout = 16888;
  private _seqNum = 0;
  private _sessionConfig!: SolaceMessageClientConfig;

  constructor(
    public gameStatus: GameStatusService,
    private myApi: AccessApiService,
    private psp: SolaceMessageClient, private log: NGXLogger,
    private ots: OtelTraceService, private route: ActivatedRoute,
    private myConfig: LoadConfigService
    ) {
  }

  private init(): void {
    this.mRequests.clear();
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

  onConnectSwitchChanged(): void {
    if (!this.isConnected) {
      this.log.info(`Connecting to ${this._sessionConfig.url}`);
      this.isWaiting = true;
      const pspStatus$ = from(this.psp.connect(this._sessionConfig));
      pspStatus$.pipe(delay(333)).subscribe({
        next: () => {
          this.isConnected = true;
          this.isWaiting = false;
          this.init();
          this.psp.observe$("_CMD_/>").subscribe(
            (envelope) => {
              const message = envelope.message;
              switch (message.getDestination().name) {
                case `_CMD_/${this.playerIdPrefix}/DISCONNECT`:
                  this.onConnectSwitchChanged();
                  this.log.info(`${this.playerId} has disconnected due to admin's request`);
                  break;
                case `_CMD_/${this.playerIdPrefix}/PING`:
                case `_CMD_/ALL/PING`:
                  this.psp.publish(`_CMD_/${this.playerIdPrefix}/PONG`, `Hello from ${this.playerId} on ${new Date()}`);
                  this.log.info(`${this.playerId} has echoed to admin`);
                  break;
                default:
                  this.log.debug(`Received unknown commmand from admin: ${message.getDestination().name}`);
                  break;
              }
            }
          )
          this.log.info(`connected to PS+ with client-name: ${this._sessionConfig.clientName}`)
        },
        error: (error) => this.log.error(`failed while connecting to ${this._sessionConfig.url}`, error)
      })
    } else {
      this.isWaiting = true;
      this.psp.disconnect().then(
        () => {
          this.isConnected = false;
          this.isWaiting = false;
          this.init();
          this.log.info(`${this._sessionConfig.clientName} has disconnected from ${this._sessionConfig.url}`)
        },
        error => this.log.error(`failed while disconnecting from ${this._sessionConfig.url}`, error)
      )
    }
  }

  onRequestButtonClicked(): void {
    // tracing
    let currSpan = this.ots.getDefaultTracer().startSpan(this.onRequestButtonClicked.name, { kind: SpanKind.PRODUCER });
    const traceId = currSpan.spanContext().traceId;
    // Create a SDT to store carrier in UserProperties
    // You may also add other properties for application
    const mySDT = new SDTMapContainer();
    // Main procedure
    this._seqNum++;
    const req = new RequestMessage(this.playerId, this._seqNum);
    req.dataVolume = getRandomNumber(1, 99);
    req.setStatus(RequestStatus.sending);
    const msg = SolclientFactory.createMessage();
    msg.setCorrelationId(req.id);
    msg.setSenderId(this._sessionConfig.clientName!);
    msg.setBinaryAttachment(JSON.stringify(req));
    msg.setDMQEligible(true);
    msg.setUserPropertyMap(mySDT);
    // tracing
    let otelCarrier = { data: null, traceId: traceId};
    currSpan.setAttribute("requestId", `${msg.getSenderId()}|${msg.getCorrelationId()}`);
    currSpan.setAttribute("senderId", `${msg.getSenderId()}`);
    propagation.inject(trace.setSpan(context.active(), currSpan), otelCarrier);
    mySDT.addField("otelCarrier", SDTFieldType.STRING, JSON.stringify(otelCarrier));
    this.log.debug(`Sending request id: ${msg.getCorrelationId()}, content: ${msg.getBinaryAttachment()}`);
    this.log.debug(`otelCarrier after injecting: ${JSON.stringify(mySDT.getField("otelCarrier").getValue())}`);
    this.psp.request$(`request/${this._sessionConfig.clientName}`, msg, { requestTimeout: this.reqTimedout }).subscribe({
      next: reply => {
        const currMsg = reply.message;
        const currRequest: RequestMessage = JSON.parse(currMsg.getBinaryAttachment()!.toString());
        this.log.debug(`Received reply with span: ${currSpan.spanContext().traceId}`);
        this.log.debug("Reply received: ", currMsg.dump());
        if (this.mRequests.has(currMsg.getCorrelationId()!)) {
          const req = this.mRequests.get(currMsg.getCorrelationId()!)!;
          const senderId = currMsg.getSenderId();
          // If the request is served by "SERVER" role, it's successful.
          if (currRequest.status == RequestStatus.success) {
            req.setStatus(RequestStatus.success);
            currSpan.addEvent(RequestStatus[RequestStatus.success]);
            currSpan.setStatus({ code: SpanStatusCode.OK });
          }
          else if (currRequest.status == RequestStatus.failed) {
            req.setStatus(RequestStatus.failed); // If served by "WATCHER", it fails.
            currSpan.addEvent(RequestStatus[RequestStatus.failed]);
            currSpan.setStatus({ code: SpanStatusCode.OK });
          }
          else {
            req.setStatus(RequestStatus.unknown);
            currSpan.addEvent(RequestStatus[RequestStatus.failed]);
            currSpan.setStatus({ code: SpanStatusCode.ERROR });
          }
        }
        currSpan.end();
      },
      error: (error: RequestError) => {
        req.setStatus(RequestStatus.timedout);
        currSpan.addEvent(RequestStatus[RequestStatus.timedout]);
        currSpan.setStatus({ code: SpanStatusCode.ERROR });
        this.log.error(`Error while waiting for reply (${req.id}): `, error.message);
        currSpan.end();
      }
    });
    req.setStatus(RequestStatus.waiting);
    this.mRequests.set(req.id, req);
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
