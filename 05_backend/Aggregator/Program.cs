using System.Data;
using System.Diagnostics;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.Loader;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using SolaceSystems.Solclient.Messaging;
using Microsoft.Extensions.Logging;
using SharedLibrary;
using Serilog;
using SolaceSystems.Solclient.Messaging;
using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .CreateLogger();

var environment = Environment.GetEnvironmentVariable("NETCORE_ENVIRONMENT");
Log.Information($"Execution environment: {environment}");
var configurationRoot = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile($"appsettings.{environment}.json", optional: true)
    .AddEnvironmentVariables().Build();

var runtimeConfig = new RuntimeConfig();
configurationRoot.GetSection("RuntimeConfig").Bind(runtimeConfig);
Console.WriteLine($"Runtime Config: {runtimeConfig.solaceConfig.hostUrl}");

// Initialize OTEL
AppContext.SetSwitch("System.Net.Http.SocketsHttpHandler.Http2UnencryptedSupport", true);
var traceProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource("Server Receiver", "Watcher Receiver")
    .ConfigureResource(r => r.AddService("Aggregator"))
    .AddOtlpExporter(opts => { opts.Endpoint = new Uri(runtimeConfig.exporterUrl); })
    .Build();

var msgCount = 0;
const int MAX_MSG_COUNT = 9;
var reqAggr = new RequestAggregator();
var requests = new Dictionary<string, ReceivedRequest>();
var receivedRequests = new Dictionary<string, ReceivedRequest>();
var WaitEventWaitHandle = new AutoResetEvent(false);
var pendingRequests = new HashSet<string>();
var serviceRecords = new Dictionary<string, ServiceRecord>();

var pspClient = new PSPClient(
    runtimeConfig.solaceConfig.hostUrl, runtimeConfig.solaceConfig.vpnName, 
    runtimeConfig.solaceConfig.userName, runtimeConfig.solaceConfig.password);
// var pspClient = new PSPClient("https://mps.fbs.com.tw", "test01", "user03", "password"); 

void directMessageHandler(object? e, MessageEventArgs args) {
    var msg = args.Message;
    var dest = args.Message.Destination.Name;
    var content = Encoding.ASCII.GetString(args.Message.BinaryAttachment);
    var userProps = args.Message.UserPropertyMap;
    ReceivedRequest rr;
    RequestStatus rs = RequestStatus.unknown;
    var source = new ActivitySource("Micro Services");
    OtelCarrier otelCarrier;
    // Log.Debug($"Destination {dest}");
    // Log.Debug($"Content {content}");

    switch (args.Message.Destination.Name) {
        case string s when Regex.IsMatch(s, @"^request\/cancel\/([0-9a-zA-Z_\-]+)"):
            Log.Debug($"Received canceling request from requestor: {dest}");
            rr = JsonSerializer.Deserialize<ReceivedRequest>(content);
            // Extract otel from userProperty
            otelCarrier = JsonSerializer.Deserialize<OtelCarrier>(userProps.GetString("otelCarrier"));
            Log.Debug($"Previous traceId in OTEL Carrier: {otelCarrier.traceId}");
            
            if (!receivedRequests.ContainsKey(rr.id)) {
                Log.Warning($"Nothing for {rr.id} can be cancelled...");
            }
            else {
                // If we receive another request with same id from same sender, this means something wrong there (usually timedout)
                // rr.updateStatus(RequestStatus.failed);
                receivedRequests[rr.id] = rr;
                reqAggr.updatePlayer(rr.senderId, rr);
                Log.Debug($"Cancelled request id {rr.id} from the sender {rr.senderId}");
            }
            break;
        case string s when Regex.IsMatch(s, @"^request\/([0-9a-zA-Z_\-]+)"):
            Log.Debug($"Received from requestor: {dest}");
            rr = JsonSerializer.Deserialize<ReceivedRequest>(content);
            if (!receivedRequests.ContainsKey(rr.id)) {
                Log.Debug($"Add new request id {rr.id} from {rr.senderId}");
                rr.updateStatus(RequestStatus.waiting);
                pendingRequests.Add(rr.id);
                receivedRequests.Add(rr.id, rr);
                reqAggr.addRequest(rr.senderId, rr);
            }
            else {
                Log.Warning($"{rr.id} is duplicated...");
            }
            break;
        case string s when Regex.IsMatch(s, @"^reply\/(server|watcher)\/([0-9a-zA-Z_\-]+)"):
            Log.Debug($"Received from server/watcher: {dest}");
            var receiver = dest.Split("/")[1];
            rr = JsonSerializer.Deserialize<ReceivedRequest>(content);
            // Extract otel from userProperty
            otelCarrier = JsonSerializer.Deserialize<OtelCarrier>(userProps.GetString("otelCarrier"));
            Log.Debug($"Previous traceId in OTEL Carrier: {otelCarrier.traceId}");

            // If the request exists and the status is waiting, we will proceed
            if (receivedRequests.ContainsKey(rr.id)) {
                // tracing
                using (var activity = source.StartActivity("Processing", ActivityKind.Server, ActivityContext.Parse(otelCarrier.traceparent, null))) {
                    activity.SetTag("solace.destination", msg.Destination.Name);
                    activity.SetTag("solace.correlationId", msg.CorrelationId);
                    activity.SetTag("solace.senderId", msg.SenderId);
                    activity.SetTag("transaction.requestorId", rr.senderId);
                    activity.SetTag("transaction.requestId", rr.id);
                    activity.SetTag("transaction.receiverId", rr.receiverId);
                    // If the status is waiting, then we will accept the processing from this receiver
                    var currStatus = receivedRequests[rr.id].status; 
                    if (currStatus == RequestStatus.waiting) {
                        Log.Information($"Request id {rr.id} is processed by {rr.receiverId}");
                        // if processed by server, it's a success transaction
                        if (receiver.Equals("server")) {
                            receivedRequests[rr.id].receiverId = rr.receiverId;
                            receivedRequests[rr.id].updateStatus(RequestStatus.success);
                            reqAggr.addRequest(rr.receiverId, rr);
                            reqAggr.updatePlayer(rr.senderId, rr);
                            activity.AddEvent(new ActivityEvent("Reply Requestor"));
                            pspClient.Reply(args.Message, JsonSerializer.Serialize(receivedRequests[rr.id]));
                            Log.Debug($"Replied to {args.Message.ReplyTo.Name} with status : {receivedRequests[rr.id]}");
                            activity.AddEvent(new ActivityEvent("Transaction Accpeted"));
                            activity.SetTag("transaction.duplicate", false);
                            activity.SetTag("transaction.status", receivedRequests[rr.id].status);
                            activity.SetStatus(ActivityStatusCode.Ok);
                        } else if (receiver.Equals("watcher")) {
                            receivedRequests[rr.id].receiverId = rr.receiverId;
                            receivedRequests[rr.id].updateStatus(RequestStatus.failed);
                            reqAggr.addRequest(rr.receiverId, rr);
                            reqAggr.updatePlayer(rr.senderId, rr);
                            activity.AddEvent(new ActivityEvent("Reply Requestor"));
                            pspClient.Reply(args.Message, JsonSerializer.Serialize(receivedRequests[rr.id]));
                            Log.Debug($"Replied to {args.Message.ReplyTo.Name} with status : {receivedRequests[rr.id]}");
                            activity.AddEvent(new ActivityEvent("Transaction Denied"));
                            activity.SetTag("transaction.duplicate", false);
                            activity.SetTag("transaction.status", receivedRequests[rr.id].status);
                            activity.SetStatus(ActivityStatusCode.Ok);
                        }
                        else {
                            Log.Warning($"Received unknown content from {dest}");
                            receivedRequests[rr.id].updateStatus(RequestStatus.unknown);
                            reqAggr.addRequest(rr.receiverId, rr);
                            reqAggr.updatePlayer(rr.senderId, rr);
                            activity.AddEvent(new ActivityEvent("Transaction Failed"));
                            activity.SetTag("transaction.duplicate", false);
                            activity.SetTag("transaction.status", receivedRequests[rr.id].status);
                            activity.SetStatus(ActivityStatusCode.Error);
                        }
                    } else if (currStatus == RequestStatus.success || currStatus == RequestStatus.failed) {
                        Log.Information($"Request id {rr.id} has been processed by {receivedRequests[rr.id].receiverId} on {receivedRequests[rr.id].updatedAt}");
                        rr.updateStatus(RequestStatus.failed);
                        reqAggr.addRequest(rr.receiverId, rr);
                        activity.AddEvent(new ActivityEvent("Transaction Processed"));
                        activity.SetTag("transaction.duplicate", true);
                        activity.SetTag("transaction.status", receivedRequests[rr.id].status);
                        activity.SetStatus(ActivityStatusCode.Error);
                    } else if (currStatus == RequestStatus.timedout) {
                        Log.Information($"Request id {rr.id} has been cancelled by {receivedRequests[rr.id].senderId} on {receivedRequests[rr.id].updatedAt}");
                        rr.updateStatus(RequestStatus.failed);
                        reqAggr.addRequest(rr.receiverId, rr);
                        activity.AddEvent(new ActivityEvent("Transaction Failed"));
                        activity.SetTag("transaction.duplicate", false);
                        activity.SetTag("transaction.status", currStatus);
                        activity.SetStatus(ActivityStatusCode.Error);
                    }
                    else {
                        Log.Warning($"Cannot update request id {rr.id}, the status is {currStatus}");
                        activity.AddEvent(new ActivityEvent("Transaction Failed"));
                        activity.SetTag("transaction.duplicate", false);
                        activity.SetTag("transaction.status", currStatus);
                        activity.SetStatus(ActivityStatusCode.Error);
                    }
                    // This is 
                    publishUpdatedRecords(rr.senderId);
                    publishUpdatedRecords(rr.receiverId);
                }
                // tracing-end
            }
            else {
                Log.Warning($"{rr.receiverId} processed a request [{rr.id}] which is not existed");
            }

            if (!pendingRequests.Contains(rr.id)) {
                rs = RequestStatus.timedout;
                Log.Warning($"Request id {rr.id} has been processed.");
            }
            else {
                rs = RequestStatus.success;
                Log.Debug($"Current request id {rr.id} is been processed by {rr.receiverId}");
                pendingRequests.Remove(rr.id);
            }
            var serviceKey = $"{rr.senderId}={rr.receiverId}";
            if (!serviceRecords.ContainsKey(serviceKey)) {
                serviceRecords.Add(serviceKey, new ServiceRecord());
            }
            serviceRecords[serviceKey].updateRecord(rr, rs);
            pspClient.Publish($"players/serviceRecords/{serviceKey}", JsonSerializer.Serialize(serviceRecords[serviceKey]));
            break;
        default:
            break;
    }
}

void myMessageHandler(object? e, MessageEventArgs args) {
    msgCount++;
    var msg = args.Message;
    var dest = args.Message.Destination.Name;
    var content = Encoding.ASCII.GetString(args.Message.BinaryAttachment);
    Log.Debug($"Destination {dest}");
    Log.Debug($"Content {content}");
    // Extract otel from userProperty
    var userProps = args.Message.UserPropertyMap;
    var otelCarrier = JsonSerializer.Deserialize<OtelCarrier>(userProps.GetString("otelCarrier"));
    Log.Debug($"Previous traceId in OTEL Carrier: {otelCarrier.traceId}");

    switch (args.Message.Destination.Name) {
        case string s when Regex.IsMatch(s, @"^reply\/(server|watcher)\/([0-9a-zA-Z_\-]+)"):
            Log.Information($"Received processed request from {args.Message.SenderId}");
            try {
                // otel stuff
                var source = new ActivitySource("Server Receiver");
                using (var activity = source.StartActivity("Aggregating", ActivityKind.Server, ActivityContext.Parse(otelCarrier.traceparent, null))) {
                    activity.AddEvent(new ActivityEvent("Check Receiver"));
                    activity.SetTag("solace.destination", msg.Destination.Name);
                    activity.SetTag("solace.correlationId", msg.CorrelationId);
                    activity.SetTag("solace.senderId", msg.SenderId);
                    var receivedReq = JsonSerializer.Deserialize<ReceivedRequest>(content);
                    receivedReq.updateStatus(RequestStatus.waiting);
                    activity.AddEvent(new ActivityEvent("Process request"));
                    activity.SetTag("transaction.requestorId", receivedReq.senderId);
                    activity.SetTag("transaction.requestId", receivedReq.id);
                    if (requests.ContainsKey(receivedReq.id)) {
                        activity.SetTag("transaction.duplicate", true);
                        activity.SetStatus(ActivityStatusCode.Error);
                        // We assign a duplicate request as timedout status, though this should be identified more clear.
                        updateRequestRecord(receivedReq.receiverId, receivedReq, RequestStatus.timedout);
                        var currReq = requests[receivedReq.id];
                        Log.Warning($"The request {receivedReq.id} has been processed by {currReq.receiverId} on {currReq.receivedAt}");
                    }
                    else {
                        activity.SetTag("transaction.duplicate", false);
                        activity.AddEvent(new ActivityEvent("Set Request Status"));
                        activity.SetTag("transaction.receiverId", receivedReq.receiverId);
                        activity.SetStatus(ActivityStatusCode.Ok);
                        Log.Debug($"Received request message from {args.Message.SenderId}: {receivedReq.senderId}, {receivedReq.id}, {receivedReq.dataVolume}");
                        if (s.Contains("server")) receivedReq.updateStatus(RequestStatus.success);
                        else receivedReq.updateStatus(RequestStatus.failed);
                        requests.Add($"{receivedReq.id}", receivedReq);
                        updateRequestRecord(receivedReq.receiverId, receivedReq, receivedReq.status);
                        updateRequestRecord(receivedReq.senderId, receivedReq, receivedReq.status);
                        activity.AddEvent(new ActivityEvent("Reply Requestor"));
                        pspClient.Reply(args.Message, JsonSerializer.Serialize(receivedReq));
                        Log.Debug($"Replied to {args.Message.ReplyTo.Name} with status : {receivedReq.status}");
                    }
                }
            }
            catch (Exception ex) {
                Log.Warning($"Recevied content is not a valid request!");
            }
            break;
        default:
            Log.Warning($"Not a expected message,\n dest: {dest}, content: {content}");
            break;
    }
}

void myFlowHandler(object? sender, FlowEventArgs args) {
    Log.Debug($"Info from flow {args.Info}");
}

void publishUpdatedRecords(string playerId) {
    Log.Debug($"Request Aggr: {JsonSerializer.Serialize(reqAggr)}");
    pspClient.Publish($"players/stats/{playerId}", reqAggr.outputRecord(playerId));
    pspClient.Publish("players/aggregatedStats", JsonSerializer.Serialize(reqAggr));
    pspClient.Publish("players/elided/aggregatedStats", JsonSerializer.Serialize(reqAggr), true, false);
}

void updateRequestRecord(string playerId, ReceivedRequest rr, RequestStatus rs) {
    reqAggr.addRequest($"{playerId}", rr, rs);
    Log.Debug($"Request Aggr: {JsonSerializer.Serialize(reqAggr)}");
    pspClient.Publish($"players/stats/{playerId}", reqAggr.outputRecord(playerId));
    pspClient.Publish("players/aggregatedStats", JsonSerializer.Serialize(reqAggr));
    pspClient.Publish("players/elided/aggregatedStats", JsonSerializer.Serialize(reqAggr), true, false);
}

pspClient.messageEventHandler = directMessageHandler;
pspClient.guaranteedMessageEventHandler = myMessageHandler;
pspClient.flowEventHandler = myFlowHandler;
pspClient.Connect();
// pspClient.Subscribe("request/>");
// pspClient.Subscribe("reply/>");
pspClient.BindQueue("q-aggregator");

// Graceful shutdown for Development and Production (containerized)
if (environment == "Development") {
    Console.CancelKeyPress += (sender, e) => {
        Log.Information("SIGQUIT received, terminating...");
        Log.Information($"Cleaning status for {pspClient.SessionProps.ClientName}");
        pspClient.clearAllSubsAndBinds();
        Log.Information($"Disconnecting from {pspClient.SessionProps.Host}");
        pspClient.Disconnect();
        WaitEventWaitHandle.Set();
        Log.Information($"ALL CLEARED!");
    };
    Console.WriteLine("Press Ctrl+C to terminate this program...");
    Console.ReadLine();
}
else {
    System.Runtime.Loader.AssemblyLoadContext.Default.Unloading += (ctx) => {
        Log.Information("SIGTERM received, terminating...");
        Log.Information($"Cleaning status for {pspClient.SessionProps.ClientName}");
        pspClient.clearAllSubsAndBinds();
        Log.Information($"Disconnecting from {pspClient.SessionProps.Host}");
        pspClient.Disconnect();
        WaitEventWaitHandle.Set();
        Log.Information($"ALL CLEARED!");
    };
}

WaitEventWaitHandle.WaitOne();

public enum RequestStatus {
    pending = 0b00000001,
    sending = 0b00000010,
    waiting = 0b00000100,
    success = 0b00001000,
    failed = 0b00010000,
    timedout = 0b00100000,
    unknown = 0b10000000
}

class OtelCarrier {
    public string data { get; set; }
    public string traceId { get; set; }
    public string traceparent { get; set; }

    public OtelCarrier() {
    }
}

class ServiceRecord {
    public string sourceService { get; set; }
    public string targetService { get; set; }
    public int totalRequests { get; set; }
    public int successRequests { get; set; }
    public int failedRequests { get; set; }
    public double totalResponseTime { get; set; }
    public DateTime updatedAt { get; private set; }

    public ServiceRecord() {
    }
    
    // Update this record with processed status
    public void updateRecord(ReceivedRequest rr, RequestStatus rs) {
        this.sourceService = rr.senderId;
        this.targetService = rr.receiverId;
        this.totalRequests++;
        // Both success and failed are valid processed results.
        if (rs == RequestStatus.success || rs == RequestStatus.failed) {
            this.successRequests++;
        }
        else {
            this.failedRequests++;
        }

        var lastUpdatedAt = this.updatedAt;
        this.updatedAt = DateTime.Now;
        // Only if there is more than one request, we calculate avgRate
        // Not a precise calculation
        if (totalRequests > 1) {
            this.totalResponseTime += Math.Round((this.updatedAt - lastUpdatedAt).TotalMilliseconds, 1);
        }
    }
}

// Actually I think this should be renamed to "PlayerRecord"
class RequestRecord {
    public string playerId { get; set; }
    public int totalRequests { get; private set; }
    public int totalVolume { get; private set; }
    public int successVolume { get; private set; }
    public int failedVolume { get; private set; }
    public double avgSuccessVolume { get; private set; }
    public double avgSuccessRate { get; set; }
    public double avgFailedVolume { get; private set; }
    public double avgFailedRate { get; set; }
    public double avgVolume { get; private set; }
    public double avgRate { get; set; }
    public DateTime updatedAt { get; private set; }
    public int successRequests { get; set; }
    public int failedRequests { get; set; }

    public RequestRecord() { }

    public RequestRecord(string playerId) {
        this.playerId = playerId;
    }

    private double calcAvgNum(int v, int r) {
        return Math.Round((double)v / r, 2);
    }

    public void add(ReceivedRequest rr) {
        this.totalRequests++;
        this.totalVolume += rr.dataVolume;
        // If the rr is the initial request from REQUESTOR role, this will always trigger warning message
        this.update(rr);
    }

    // This should be updated with more "correct" logic, we may have another array to store this player's requests.
    public void update(ReceivedRequest rr) {
        if (rr.status == RequestStatus.success) {
            this.successRequests++;
            this.successVolume += rr.dataVolume;
            this.avgSuccessVolume = this.calcAvgNum(this.successVolume, this.successRequests);
        } else if (rr.status == RequestStatus.failed || rr.status == RequestStatus.timedout) {
            this.failedRequests++;
            this.failedVolume += rr.dataVolume;
            this.avgFailedVolume = this.calcAvgNum(this.failedVolume, this.failedRequests);
        }
        else {
            Log.Warning($"Not a valid status in {rr.id}: {rr.status}");
        }
        var lastUpdatedAt = this.updatedAt;
        this.updatedAt = DateTime.Now;
        // Only if there is more than one request, we calculate avgRate
        // Not a precise calculation
        if (this.totalRequests > 1) {
            this.avgRate = this.calcAvgNum(this.totalRequests, (int)(this.updatedAt - lastUpdatedAt).TotalSeconds);
        }
    }

    // Update this record with processed status
    public void updateRecord(ReceivedRequest rr, RequestStatus rs) {
        this.totalRequests++;
        // Both success and failed are valid processed results.
        if (rs == RequestStatus.success || rs == RequestStatus.failed) {
            this.successRequests++;
            this.totalVolume += rr.dataVolume;
            this.avgVolume = Math.Round((double)totalVolume / successRequests, 2);
        }
        else {
            this.failedRequests++;
        }

        var lastUpdatedAt = this.updatedAt;
        this.updatedAt = DateTime.Now;
        // Only if there is more than one request, we calculate avgRate
        // Not a precise calculation
        if (totalRequests > 1) {
            this.avgRate = Math.Round(this.totalRequests / (this.updatedAt - lastUpdatedAt).TotalSeconds, 2);
        }
    }
}

// This should also be renamed to PlayerRecordAggregator
class RequestAggregator {
    public int totalEvents { get; set; }
    public int totalVolume { get; set; }
    public int successVolume { get; set; }
    public int failedVolume { get; set; }
    public int lossVolume { get; set; }
    public double avgVolume { get; set; }
    public double avgRate { get; set; }
    public Dictionary<string, RequestRecord> requestRecords = new Dictionary<string, RequestRecord>();
    public DateTime updatedAt { get; private set; }
    public int successEvents { get; set; }
    public int failedEvents { get; set; }

    public RequestAggregator() {
    }

    // This will create a new record for playerId
    public void addPlayer(string playerId) {
        // If reqSender is not recorded, create.
        if (!requestRecords.ContainsKey(playerId)) {
            requestRecords.Add(playerId, new RequestRecord());
        }
    }
    
    // This will add a new request from REQUESTOR role
    public void addRequest(string playerId, ReceivedRequest rr) {
        if (!requestRecords.ContainsKey(playerId)) {
            this.addPlayer(playerId);
        }
        this.requestRecords[playerId].add(rr);
        totalEvents++;
    }
    
    // This will update an existed request, mainly for REQUESTOR role
    public void updatePlayer(string playerId, ReceivedRequest rr) {
        if (requestRecords.ContainsKey(playerId)) {
            this.requestRecords[playerId].update(rr);
        }
    }
    
    public void addRequest(string playerId, ReceivedRequest rr, RequestStatus rs) {
        // If reqSender is not recorded, create.
        if (!requestRecords.ContainsKey(playerId)) {
            requestRecords.Add(playerId, new RequestRecord());
        }
        // Update the reqSender with received request
        Log.Debug($"Current average volume of player [{playerId}]: {requestRecords[playerId].avgVolume}");
        requestRecords[playerId].updateRecord(rr, rs);
        Log.Debug($"Updated average volume: {requestRecords[playerId].avgVolume}");
        totalEvents++;
        // Both success and failed are valid processed results.
        if (rs == RequestStatus.success || rs == RequestStatus.failed) {
            this.successEvents++;
            this.totalVolume += rr.dataVolume;
            this.avgVolume = Math.Round((double)totalVolume / successEvents, 2);
        }
        else {
            this.failedEvents++;
        }
        var lastUpdatedAt = this.updatedAt;
        this.updatedAt = DateTime.Now;
        // Only if there is more than one request, we calculate avgRate
        // Not a precise calculation
        if (totalEvents > 1) {
            this.avgRate = Math.Round(this.totalEvents / (this.updatedAt - lastUpdatedAt).TotalSeconds, 2);
        }
    }
    
    /*
    public void addRequest(string reqReceiverId, ReceivedRequest rr) {
        // If reqSender is not recorded, create.
        if (!requestRecords.ContainsKey(reqReceiverId)) {
            requestRecords.Add(reqReceiverId, new RequestRecord());
        }
        // Update the reqSender with received request
        Log.Debug($"Current average volume of receiver [{reqReceiverId}]: {requestRecords[reqReceiverId].avgVolume}");
        requestRecords[reqReceiverId].addRequest(rr);
        Log.Debug($"Updated average volume: {requestRecords[reqReceiverId].avgVolume}");
        totalRequests++;
        totalVolume += rr.dataVolume;
        avgVolume = Math.Round((double)totalVolume / totalRequests, 2);
        updatedAt = DateTime.Now;
    }
    */

    public string outputRecord(string playerId) {
        return JsonSerializer.Serialize(this.requestRecords.ContainsKey(playerId)? this.requestRecords[playerId]: null);
    }

    public void outputStatus() {
        Log.Information($"All records: \n{JsonSerializer.Serialize(this.requestRecords)}");
    }
}

class ReceivedRequest {
    public string reqSender { get; set; }
    public int reqId { get; set; }
    public int reqVolume { get; set; }
    public string id { get; set; }
    public string senderId { get; set; }
    public int seqNum { get; set; }
    public string receiverId { get; set; }
    public string receiverProcessId { get; set; }
    public int dataVolume { get; set; }
    public string serverId { get; private set; }
    public RequestStatus status { get; private set; }
    public DateTime receivedAt { get; private set; }
    public DateTime updatedAt { get; private set; }

    public ReceivedRequest() {
        this.status = RequestStatus.unknown;
        this.receivedAt = DateTime.Now;
    }
    
    public void updateFromServer(string id, RequestStatus rs) {
        this.updateServerId(id);
        this.updateStatus(rs);
    }

    public void updateStatus(RequestStatus rs) {
        this.status = rs;
        this.updatedAt = DateTime.Now;
    }

    public void updateServerId(string id) {
        this.serverId = id;
        this.updatedAt = DateTime.Now;
    }
}