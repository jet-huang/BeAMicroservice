using Microsoft.Extensions.Primitives;

namespace OpenAPI.Models; 

public class GameParameters {
    public string gameTitle { get; set; } = "NO GAME TITLE";
    public int numServers { get; set; } = 0;
    public int numWatchers { get; set; } = 0;
    public string nameRequestor { get; set; } = "REQUESTOR";
    public string nameServer { get; set; } = "SERVER";
    public string nameWatcher { get; set; } = "WATCHER";
    public string buttonTextRequestor { get; set; } = "Send Request";
    public string buttonTextServer { get; set; } = "ACK";
    public string buttonTextWatcher { get; set; } = "Notify";
}