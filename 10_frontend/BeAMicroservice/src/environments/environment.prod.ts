export const environment = {
  production: true,
  logger: {
    // level: 'DEBUG'
    level: 'INFO'
    // level: 'WARN'
  },
  apiBaseUrl: "https://temp-backend.crabdance.com",
  solace: {
    "protocol": "wss",
    "host": "temp-psplus.crabdance.com",
    "port": 443,
    "vpnName": "default",
    "userName": "default",
    "password": "default",
  },
  serviceName: "BAM-Frontend",
  exporterUrl: "https://footprint.crabdance.com/v1/traces"
};
