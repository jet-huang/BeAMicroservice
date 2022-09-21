using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Server.IIS.Core;
using Microsoft.OpenApi.Extensions;

namespace OpenAPI.Models;

public enum GameStatus {
    STOPPED,
    STARTING,
    WAITING,
    RUNNING,
    STOPPING,
    PAUSED,
    DISABLED,
    UNKNOWN
}

public class GameStatusRepository {
    private GameStatus _status;
    public GameStatus status {
        get { return this._status; }
        set {
            this._status = value;
            this.statusDesc = this._status.GetDisplayName();
        }
    }
    public string statusDesc { get; set; }
    public GameParameters parameters { get; set; }
    public PlayerRepo players { get; set; }

    public GameStatusRepository() {
        this.status = GameStatus.DISABLED;
        this.parameters = new GameParameters();
        this.players = new PlayerRepo();
    }
}