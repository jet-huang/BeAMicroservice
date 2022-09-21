export interface OnlineClient {
  clientName: string;
  isConnected: boolean;
  isOnService: boolean;
  receivedCount: number;
  processedCount: number;
  timedout: number;
  appType: string;  // X is unknown client
}
