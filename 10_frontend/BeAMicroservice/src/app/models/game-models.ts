export interface Player {
  name:         string;
  id:           string;
  roleId:       string;
  roleTypeDesc: string;
  rolePrefix:   string;
  roleType:     number;
}

export interface GameParameters {
  gameTitle: string;
  numServers: number;
  numWatchers: number;
  nameRequestor: string;
  nameServer: string;
  nameWatcher: string;
  buttonTextRequestor: string;
  buttonTextServer: string;
  buttonTextWatcher: string;
}

export interface ClientConnection {
  roleId: string;
  ip: string;
  isConnected: boolean;
  isOnService: boolean;
  updatedOn: Date;
}

export class OnlineClient implements Player {
  name = "NO-NAME-CLIENT";
  id = "NO-ID";
  roleId = "NO-ROLE-ID";
  roleTypeDesc = "NO-ROLE-TYPE-DESC";
  rolePrefix = "NO-ROLE-PREFIX";
  roleType = 0;
  isConnected = false;
  isOnService = false;
  connectedOn: Date;
  disconnectedOn: Date | undefined;

  constructor() {
    this.connectedOn = new Date();
  }
}

export interface PlayerRecord {
  totalRequests:   number;
  totalVolume:     number;
  avgVolume:       number;
  avgRate:         number;
  updatedAt:       Date;
  successRequests: number;
  failedRequests:  number;
}

// Generated by https://quicktype.io
export interface AggregatedStats {
  totalEvents:   number;
  totalVolume:   number;
  avgVolume:     number;
  avgRate:       number;
  updatedAt:     Date;
  receivedAt:    Date;
  successEvents: number;
  failedEvents:  number;
  timediff:      number;
}

export class GameModels {
}
