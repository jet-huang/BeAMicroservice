import { LoadConfigService } from './load-config.service';
import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { SolclientFactory, Message } from 'solclientjs';

export function roundedBy(n: number, p: number) {
  const pos = Math.pow(10, p);
  return Math.round((n + Number.EPSILON) * pos) / pos;
}

export function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function getPaddingRandomNumer(min: number, max: number, padding: number) {
  return getRandomNumber(min, max).toString().padStart(padding, "0");
}

export function createRequestId(prefix: string, seqNum: number): string {
  return `${prefix}__${seqNum.toString().padStart(4, "0")}${Date.now().toString().slice(-4)}`;
}

export function createPlayerId(): string {
  // sample uuid: 45637ec4-c85f-11ea-87d0-0242ac130003
  const tmpId = uuidv4();
  // We are using last 5 characters with a 5-digit random number
  return `${tmpId.substring(tmpId.lastIndexOf("-") + 8, tmpId.length).toUpperCase()}_${getRandomNumber(10000,99999)}`;
}

export function createSolaceConnectionUrl(protocol: string, host: string, port: number): string {
  return `${protocol}://${host}:${port}`;
}

export function createSolaceSessionClientName(prefix: string): string {
  return `${prefix}${getRandomNumber(100000,999999)}_${getRandomNumber(100000,999999)}`;
}

export function decodeBinaryText(text: string | undefined): string {
  if (!text) return "";

  let charArr = [];
  for (let i = 0; i < text.length; i++) {
      charArr.push(text.charCodeAt(i));
  }

  return new TextDecoder().decode(new Uint8Array(charArr));
}

export function getSolaceClientNameByTopic(logTopic: string): string{
  // Matching the number of slash (/) in logTopic
  // Sample: #LOG/INFO/CLIENT/solbroker/CLIENT_CLIENT_CONNECT/default/j-dev02-g4/2828816/00000001/UAyx-L-mD0
  const INDEX_START = 6;
  const tmpArray = logTopic.split("/")
  var clientName = "";
  for (let i = 6; i<tmpArray.length; i++) {
    clientName += tmpArray[i];
  }
  return clientName;
}

export function getSolaceClientIpByConnectLog(log: string): string {
  // Connect log will show client ip in position 19
  const INDEX_START = 19;
  // We want to remove port number
  return log.split(" ")[INDEX_START].split(":")[0];
}

// Generally it will only have R, S or W. If none of this can be identified, return X.
export function getAppTypeByClientName(clientName: string): string {
  var appType = "X";
  const regexp = new RegExp("(R|S|W)-");
  const matchGroup = regexp.exec(clientName);
  if (null != matchGroup && matchGroup.length > 0) {
    appType = matchGroup[0];  // Get the first matched
  }
  return appType;
}

export function isPropertyValid(property: any): boolean {
  // We use nullish statement to make things easier
  const currProperty = property ?? null;
  return (null == currProperty ? false : true);
}

export function cloneSolaceMessage(msg: Message): Message {
  const clonedMsg = SolclientFactory.createMessage();
  clonedMsg.setDestination(msg.getDestination());
  clonedMsg.setDeliveryMode(msg.getDeliveryMode());
  clonedMsg.setCorrelationId(msg.getCorrelationId());
  clonedMsg.setElidingEligible(msg.isElidingEligible());
  clonedMsg.setDMQEligible(msg.isDMQEligible());
  clonedMsg.setTimeToLive(msg.getTimeToLive());
  clonedMsg.setUserCos(msg.getUserCos());
  clonedMsg.setUserData(msg.getUserData());
  // These properties need to be test if it's existed
  if (isPropertyValid(msg.getBinaryAttachment())) clonedMsg.setBinaryAttachment(msg.getBinaryAttachment()!);
  if (isPropertyValid(msg.getReplyTo())) clonedMsg.setReplyTo(msg.getReplyTo()!);
  if (isPropertyValid(msg.getSenderId())) clonedMsg.setSenderId(msg.getSenderId()!);
  if (isPropertyValid(msg.getSenderTimestamp())) clonedMsg.setSenderTimestamp(msg.getSenderTimestamp()!);
  if (isPropertyValid(msg.getUserPropertyMap())) clonedMsg.setUserPropertyMap(msg.getUserPropertyMap()!);

  return clonedMsg;
}

@Injectable({
  providedIn: 'root'
})
export class CommonFunctionsService {

  constructor() { }
}
