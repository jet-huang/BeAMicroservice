export enum RequestStatus {
  pending = 0b00000001,
  sending = 0b00000010,
  waiting = 0b00000100,
  success = 0b00001000,
  failed = 0b00010000,
  timedout = 0b00100000,
  unknown = 0b10000000
}

export class EnumRequestStatus {
}
