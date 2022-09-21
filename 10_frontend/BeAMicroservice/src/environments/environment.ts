// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  logger: {
    level: 'DEBUG'
    // level: 'INFO'
    // level: 'WARN'
  },
  apiBaseUrl: "http://dev01.jbls.tw:38888",
  solace: {
    "protocol": "ws",
    "host": "dev01.jbls.tw",
    "port": 8008,
    "vpnName": "default",
    "userName": "default",
    "password": "default",
  },
  serviceName: "DEV-BAM-frontend",
  exporterUrl: "http://dev01.jbls.tw:4318/v1/traces"
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
