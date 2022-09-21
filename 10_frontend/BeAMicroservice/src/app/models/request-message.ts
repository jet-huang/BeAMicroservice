import { RequestStatus } from "./enum-request-status";
import { createRequestId } from "../services/common-functions.service";

export class RequestMessage {
  public id!: string;
  public senderId: string;
  public seqNum: number;
  public receiverId: string;
  public receiverProcessId: string;
  public dataVolume: number;
  public status!: RequestStatus;
  public statusText!: string;

  constructor(senderId: string, seqNum: number) {
    this.senderId = senderId;
    this.seqNum = seqNum;
    this.setId();
    this.receiverId = "NO_RECEIVER_YET";
    this.receiverProcessId = "N_A";
    this.dataVolume = 0;
    this.setStatus(RequestStatus.pending);
  }

  public setId(): void {
    this.id = `${createRequestId(this.senderId, this.seqNum)}`;
  }

  public setStatus(status: RequestStatus): void {
    this.status = status;
    this.statusText = RequestStatus[this.status];
  }
}
