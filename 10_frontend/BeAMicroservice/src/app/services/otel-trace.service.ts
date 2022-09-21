import { Injectable } from '@angular/core';
// OpenTelemetry
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, SimpleSpanProcessor, ConsoleSpanExporter, Tracer } from '@opentelemetry/sdk-trace-base';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// self-defined
import { LoadConfigService } from './load-config.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OtelTraceService {
  // OTEL
  exporter = new OTLPTraceExporter({
    url: this.myConfig.runtimeConfig.exporterUrl
  });
  provider = new WebTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.myConfig.runtimeConfig.serviceName
    })
  });

  constructor(private myConfig: LoadConfigService) {
    this.initOpenTelemetry();
  }

  public init(serviceName: string): void {
    this.provider = new WebTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName
      })
    });
    this.initOpenTelemetry();
  }

  private initOpenTelemetry(): void {
    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-user-interaction': {
            enabled: false
          },
          '@opentelemetry/instrumentation-document-load': {
            enabled: false
          },
          '@opentelemetry/instrumentation-xml-http-request': {
            enabled: true,
            propagateTraceHeaderCorsUrls: [
              /.+/g,
            ]
          },
          '@opentelemetry/instrumentation-fetch': {
            enabled: true,
            propagateTraceHeaderCorsUrls: [
             /.+/g,
            ]
          }
        })
      ]
    });

    if (environment.logger.level == 'DEBUG') {
      this.provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter));
    }
    this.provider.addSpanProcessor(new BatchSpanProcessor(this.exporter));
    this.provider.register({
      contextManager: new ZoneContextManager()
    });
  }

  // This function will return a tracer with the name of current serviceName
  public getDefaultTracer(): Tracer {
    return this.provider.getTracer(this.myConfig.runtimeConfig.serviceName);
  }
  // This function will return a new tracer with assigned name
  public getTracer(serviceName: string): Tracer {
    this.init(serviceName);
    return this.provider.getTracer(serviceName);
  }
}
