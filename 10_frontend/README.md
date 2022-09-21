# solace-demo-banking-frontend

Demo for Solace in banking industry, frontend side mainly powered by Angular.

## Getting started
- Create a docker network:
```shell
docker network create solace-demo-fsi
```

- Edit environment vars
  ```shell
  cp env-sample .env
  vi .env
  ```

- Run with docker-compose
  ```shell
  docker-compose up -d
  ```

## For Developers
### Generic Packages
```shell
# Bootstrap 5
npm install --save bootstrap@latest-5
# ngx-logger
npm install --save ngx-logger
# OpenTelemetry
npm install --save @opentelemetry/api @opentelemetry/sdk-trace-web @opentelemetry/exporter-trace-otlp-http @opentelemetry/auto-instrumentations-web @opentelemetry/context-zone
# Solace API and client for Angular
npm install --save @solace-community/angular-solace-message-client solclientjs @scion/toolkit
npm install --save-dev @types/events @types/long
```

### Angular/TypeScript related files
- angular.json
  - Add: "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js" to scripts section
  - Mod: "budget" for surpress some false alarms.
- package.json
  - Mod: Update name and version
- environments

### Docker related files
- Dockerfile
  - Mod: appBaseHref

### Others
- favicon.ico
- style.css (Update preferred theme url)

## Some tips
### Bootstrap
It looks like ng-bootstrap (even in the current 12.x) is not working very well with Angular13, so I would prefer install maually.