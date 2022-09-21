import { OnlineClient, Player, GameParameters } from 'src/app/models/game-models';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameStatusService {
  activePlayer?: Player;
  gameParameters?: GameParameters;
  occupiedPlayers: Player[] = [];
  availablePlayers: Player[] = [];
  onlineClients: OnlineClient[] = [];
  updateStatus: Subject<boolean> = new Subject<boolean>();

  constructor() { }
}
