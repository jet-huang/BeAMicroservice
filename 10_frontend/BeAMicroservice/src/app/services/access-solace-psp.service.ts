import { error } from 'console';
import { Injectable } from '@angular/core';
import { LoadConfigService } from './../services/load-config.service';
import { ActivatedRoute } from '@angular/router';
import { OtelTraceService } from './../services/otel-trace.service';
import { MessageEnvelope, SolaceMessageClient, SolaceMessageClientConfig } from '@solace-community/angular-solace-message-client';
import { Observable, from, delay, Subject, takeUntil, Subscription, BehaviorSubject } from 'rxjs';
import { NGXLogger } from 'ngx-logger';
import opentelemetry, { Span, propagation, context, SpanKind, Context, SpanStatusCode } from '@opentelemetry/api';
import {
  Message, MessageConsumerAcknowledgeMode,
  QueueDescriptor, QueueType,
  SDTMapContainer, SDTFieldType,
  SolclientFactory,
  Session,
  Destination,
  SessionEventCode
} from 'solclientjs';

import { createSolaceConnectionUrl, createSolaceSessionClientName, decodeBinaryText } from '../services/common-functions.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AccessSolacePSPService {
  isConnected = false;
  isOnService = false;
  public clientName: string = "";
  public connectStatus$: Subject<boolean> = new Subject<boolean>();
  public serviceStatus$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public currentMessage$: Subject<Message> = new Subject<Message>();
  private _directMessage$: Subject<Message> = new Subject<Message>();
  private _guaranteedMessage$: Subject<Message> = new Subject<Message>();
  private _sessionConfig!: SolaceMessageClientConfig;
  private _subscription: Subscription | null = null;
  private _pspSession!: Session;
  private _subscribedTopics = new Map<string, Subscription>();
  private _boundFlows = new Map<string, Subscription>();
  public solclientSession = this._pspSession;


  constructor(
    public psp: SolaceMessageClient, private log: NGXLogger,
    private myConfig: LoadConfigService
  ) { }

  private updateSessionProperties(): void {
    this.clientName = (this.clientName.length <= 0) ? createSolaceSessionClientName("PSPCLIENT-NO-NAME") : this.clientName;
    this._sessionConfig = {
      url: createSolaceConnectionUrl(
        this.myConfig.runtimeConfig.solace.protocol,
        this.myConfig.runtimeConfig.solace.host,
        this.myConfig.runtimeConfig.solace.port
      ),
      vpnName: this.myConfig.runtimeConfig.solace.vpnName,
      userName: this.myConfig.runtimeConfig.solace.userName,
      password: this.myConfig.runtimeConfig.solace.password,
      clientName: this.clientName
    }
  }

  public streamDirectMessage(): Observable<Message> {
    return this._directMessage$.asObservable();
  }

  public streamGuaranteedMessage(): Observable<Message> {
    return this._guaranteedMessage$.asObservable();
  }

  public connect(): void {
    if (!this.isConnected) {
      this.updateSessionProperties();
      this.log.info(`Connecting to ${this._sessionConfig.url}`);
      this.psp.connect(this._sessionConfig).then(
        (session) => {
          this._pspSession = session;
          this.solclientSession = this._pspSession;
          this.isConnected = true;
          this.connectStatus$.next(this.isConnected);
          this.log.info(`connected to PS+ with client-name: ${this._sessionConfig.clientName}`);
          this.log.debug(`Property from session: ${this._pspSession.getSessionProperties().virtualRouterName}`);
        },
        (error) => {
          this.log.error(`failed while connecting to ${this._sessionConfig.url}`, error);
        }
      ).then(
        () => {
          this.psp.observe$("DUMMY_TOPIC").subscribe(
            envelope => { this.currentMessage$.next(envelope.message); }
          );
        }
      );
    } else {
      this.log.warn(`Solace PSP service is connected to ${this._sessionConfig.url}`);
    }
  }

  public disconnect(): void {
    if (this.isConnected) {
      this.psp.disconnect().then(
        () => {
          this.isConnected = false;
          this.connectStatus$.next(this.isConnected);
          this.log.info(`${this._sessionConfig.clientName} has disconnected from ${this._sessionConfig.url}`)
        },
        error => this.log.error(`failed while disconnecting from ${this._sessionConfig.url}`, error)
      )
    } else {
      this.log.warn(`Solace PSP service is NOT connected yet.`);
    }
  }

  public subscribe(topicName: string): void {
    this.log.debug(`Subscribing ${topicName}...`);
    if (this.isConnected && !this._subscribedTopics.has(topicName)) {
      this._subscribedTopics.set(topicName,
        this.psp.observe$(topicName).subscribe({
          next: (envelope) => { this._directMessage$.next(envelope.message); },
          error: (error) => { this.log.error(`Error occurred while receving direct message: ${error}`); }
        })
      );
    } else {
      this.log.warn(`Topic ${topicName} has been subscribed.`);
    }
  }

  public unsubscribe(topicName: string): void {
    this.log.debug(`Unsubscribing ${topicName}...`);
    if (this.isConnected && this._subscribedTopics.has(topicName)) {
      this._subscribedTopics.get(topicName)?.unsubscribe();
      this._subscribedTopics.delete(topicName);
    } else {
      this.log.warn(`Topic ${topicName} isn't subscribed (yet).`);
    }
  }

  public unsubscribeAll(): void {
    var count = 0;
    this.log.debug(`Unsubscribing all (${this._subscribedTopics.size}) topics...`)
    for (let [key, value] of this._subscribedTopics) {
      this.unsubscribe(key);
      count++;
    }
    this.log.debug(`All (${count}) topics are unsubscribed.`);
  }

  public bind(queueName: string): void {
    this.log.debug(`Binding to ${queueName}...`);
    if (this.isConnected && !this._boundFlows.has(queueName)) {
      const consumer$: Observable<MessageEnvelope> = this.psp.consume$({
        acknowledgeMode: MessageConsumerAcknowledgeMode.CLIENT,
        queueDescriptor: new QueueDescriptor({ type: QueueType.QUEUE, name: queueName }),
        // @ts-expect-error: typedef(solclientjs): remove 'queueProperties' when changed 'queueProperties' to optional
        queueProperties: undefined,
      });

      this._boundFlows.set(queueName, consumer$.subscribe({
        next: (envelope) => { this._guaranteedMessage$.next(envelope.message); },
        error: (error) => { this.log.error(`Error occurred while receving guaranteed message: ${error}`); }
      })
      );
    } else {
      this.log.warn(`Queue ${queueName} has been bound.`);
    }
  }

  public unbind(queueName: string): void {
    this.log.debug(`Unbinding from ${queueName}...`);
    if (this.isConnected && this._boundFlows.has(queueName)) {
      this._boundFlows.get(queueName)?.unsubscribe();
      this._boundFlows.delete(queueName);
    } else {
      this.log.warn(`Queue ${queueName} isn't bound (yet).`);
    }
  }

  public unbindAll(): void {
    var count = 0;
    this.log.debug(`Unbinding all (${this._boundFlows.size}) queues...`)
    for (let [key, value] of this._boundFlows) {
      this.unbind(key);
      count++;
    }
    this.log.debug(`All (${count}) queues are unbound.`);
  }

  public unsubscribeAndUnbindAll(): void {
    this.unsubscribeAll();
    this.unbindAll();
  }
}
