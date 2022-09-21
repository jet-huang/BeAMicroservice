using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.CompilerServices;
using Microsoft.OpenApi.Extensions;
using Microsoft.OpenApi.Services;
using OpenAPI.Models;
using Serilog;

namespace OpenAPI.Controllers; 

[ApiController]
[Route("api/[controller]/v1")]
public class GameMakerController : ControllerBase {
    private readonly ILogger<PhysicalBankController> _logger;
    private ActivitySource _source;
    private readonly IConfiguration _config;
    // private static GameParameters gp = new GameParameters();
    private static readonly GameStatusRepository gsr = new GameStatusRepository();
    // private static List<BaseRole> lRoles = new List<BaseRole>();
    // private static PlayerRepo players = new PlayerRepo();

    public GameMakerController(ILogger<PhysicalBankController> logger, IConfiguration config)
    {
        _logger = logger;
        _source = new ActivitySource("GameMakerController", "1.0.0");
        _config = config;
    }

    #region API implementation
    private void initGame(int numServers, int numWatchers) {
        gsr.players.init();
        // Then we add other 2 roles by assigned amount
        for (int i = 0; i < numWatchers; i++) {
            gsr.players.addRole(new WatcherRole());
        }
        for (int i = 0; i < numServers; i++) {
            gsr.players.addRole(new ServerRole());
        }
        // We must have at least one requestor to trigger the game
        // Since the inner data structure of players is stack, we should push the requestor last.
        gsr.players.addRole(new RequestorRole());
        gsr.status = GameStatus.WAITING;
    }

    private void initGame(GameParameters gp) {
        gsr.players.init();
        // Then we add other 2 roles by assigned amount
        for (int i = 0; i < gp.numWatchers; i++) {
            gsr.players.addRole(new WatcherRole(gp.nameWatcher));
        }
        for (int i = 0; i < gp.numServers; i++) {
            gsr.players.addRole(new ServerRole(gp.nameServer));
        }
        // We must have at least one requestor to trigger the game
        // Since the inner data structure of players is stack, we should push the requestor last.
        gsr.players.addRole(new RequestorRole(gp.nameRequestor));
        // also set up requestor name for automatically generated ones.
        gsr.players.nameRequestor = gp.nameRequestor;
        gsr.status = GameStatus.WAITING;
    }
    #endregion

    #region API endpoints

    [HttpPost("role")]
    public IActionResult occupyRole([FromBody] string id) {
        Log.Information($"Occupying role with id {id}");
        var rc = gsr.players.occupyRole(id);
        if (rc == null) {
            Log.Warning($"Cannot occupy role with id {id}");
            return BadRequest();
        }
        else {
            Log.Information($"Occupied role {rc.roleTypeDesc} with {rc.name}");
            return new JsonResult(rc);
        }
    }

    [HttpPost("game")]
    public IActionResult postGame([FromBody] GameParameters gp) {
        gsr.status = GameStatus.STARTING;
        gsr.parameters = gp;
        Log.Debug($"Initialize game [{gp.gameTitle}] for {gp.nameRequestor} with SERVERS: [{gp.numServers}] (as {gp.nameServer}), WATCHERS: [{gp.numWatchers}] (as {gp.nameWatcher})");
        // this.initGame(gp.numServers, gp.numWatchers);
        this.initGame(gp);
        Log.Debug($"Game [{gsr.parameters.gameTitle}] initialized with SERVERS: [{gsr.parameters.numServers}], WATCHERS: [{gsr.parameters.numWatchers}]");
        return Ok();
    }
    
    [HttpGet("game")]
    public JsonResult getGameStatusRepository() {
        return new JsonResult(gsr);
    }

    [HttpGet("game/parameters")]
    public JsonResult getGameParameters() {
        return new JsonResult(gsr.parameters);
    }

    [HttpGet("game/status")]
    public JsonResult getGameStatus() {
        return new JsonResult(gsr.statusDesc);
    }
    
    [HttpPatch("game/status")]
    public IActionResult updateGameStatus([FromBody] string statusDesc) {
        var isSuccess = true;
        Log.Debug($"Trying to change game status to {statusDesc}");
        // Currently we only provide some status can be pacthed with this call
        if (statusDesc.Equals(GameStatus.RUNNING.GetDisplayName())) gsr.status = GameStatus.RUNNING;
        else if (statusDesc.Equals(GameStatus.STOPPED.GetDisplayName())) gsr.status = GameStatus.STOPPED;
        else if (statusDesc.Equals(GameStatus.PAUSED.GetDisplayName())) gsr.status = GameStatus.PAUSED;
        else isSuccess = false;

        return isSuccess ? Ok() : BadRequest();
    }

    [HttpGet("roles")]
    public JsonResult getOccupiedRoles() {
        _logger.LogInformation(message: "Get occupied [roles] on GameMaker");
        // initDemo();
        return new JsonResult(gsr.players.getOccupiedRoles());
    }

    [HttpGet("availableRoles")]
    public JsonResult getAvailableRoles() {
        _logger.LogInformation(message: "Get available [roles] on GameMaker");
        // initDemo();
        return new JsonResult(gsr.players.getAvailableRoles());
    }
    #endregion API endpoints
}