using System.Collections;
using System.Reflection.Emit;
using System.Text;
using Serilog;
using SolaceSystems.Solclient.Messaging;
using System.Security.Cryptography.X509Certificates;
using System.Xml;
using Serilog.Core;

namespace SharedLibrary;

public class PSPClient : IDisposable {
    const int DefaultReconnectRetries = 3;
    public string VPNName { get; set; }
    public string UserName { get; set; }
    public string Password { get; set; }
    public string HostUrl { get; set; }
    public SessionProperties SessionProps { get; private set; }
    private Dictionary<string, ITopic> _subscribedTopics = new Dictionary<string, ITopic>();
    private Dictionary<string, IFlow> _bindedQueues = new Dictionary<string, IFlow>();
    private readonly IContext _context;
    private SolaceSystems.Solclient.Messaging.ISession _session;
    private bool isConnected = false;
    public EventHandler<MessageEventArgs> messageEventHandler { get; set; }
    public EventHandler<SessionEventArgs> sessionEventHandler { get; set; }
    public EventHandler<FlowEventArgs> flowEventHandler { get; set; }
    public EventHandler<MessageEventArgs> guaranteedMessageEventHandler { get; set; }
    private readonly string[] SECURE_PROTOCOLS = { "wss://", "https://", "tcps://" };

    public PSPClient() {
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .WriteTo.Console()
            .CreateLogger();
        // Initialize Solace Systems Messaging API with logging to console at some level
        ContextFactoryProperties cfp = new ContextFactoryProperties() {
            SolClientLogLevel = SolLogLevel.Info
        };
        cfp.LogToConsoleError();
        ContextFactory.Instance.Init(cfp);
        _context = ContextFactory.Instance.CreateContext(new ContextProperties(), null);
        HostUrl = "dev01";
        VPNName = "default";
        UserName = "default";
        Password = "default";
        updateSessionProps();
    }

    public PSPClient(string hostUrl, string vpnName, string userName, string password) {
        // Initialize Solace Systems Messaging API with logging to console at some level
        ContextFactoryProperties cfp = new ContextFactoryProperties() {
            SolClientLogLevel = SolLogLevel.Info
        };
        cfp.LogToConsoleError();
        ContextFactory.Instance.Init(cfp);
        _context = ContextFactory.Instance.CreateContext(new ContextProperties(), null);
        HostUrl = hostUrl;
        VPNName = vpnName;
        UserName = userName;
        Password = password;
        updateSessionProps();
    }

    public void updateSessionProps() {
        // Create session properties
        SessionProps = new SessionProperties() {
            Host = HostUrl,
            VPNName = VPNName,
            UserName = UserName,
            Password = Password,
            ClientName = "PSPClient_" + Guid.NewGuid(),
            ReconnectRetries = DefaultReconnectRetries,
            GdWithWebTransport = true
        };
        // Check if it's a secure session, and use Local, Root as certs' store
        foreach (var protocol in SECURE_PROTOCOLS) {
            if (HostUrl.StartsWith(protocol)) {
                X509Store store = new X509Store(StoreName.Root, StoreLocation.LocalMachine);
                store.Open(OpenFlags.OpenExistingOnly | OpenFlags.ReadOnly);
                SessionProps.SSLValidateCertificate = true;
                SessionProps.SSLTrustStore = store.Certificates;
                store.Close();
                Log.Debug($"Using secure session as the preferred protocol is {protocol}");
                break;
            }
        }
    }

    public void Connect() {
        updateSessionProps();
        if (!isConnected) {
            // Connect to the Solace messaging router
            _session = _context.CreateSession(SessionProps, messageEventHandler, sessionEventHandler);
            Console.WriteLine("Connecting as {0}@{1} on {2}...", UserName, VPNName, HostUrl);
            ReturnCode returnCode = _session.Connect();
            if (returnCode == ReturnCode.SOLCLIENT_OK) {
                isConnected = true;
                // Automatically subscribe "_CMD_"
                this.Subscribe("_CMD_");
                Console.WriteLine("Session successfully connected.");
            }
            else {
                Console.WriteLine("Error connecting, return code: {0}", returnCode);
            }
        }
        else {
            Console.WriteLine($"Messaging service has connected to {HostUrl}, client name: {_session.Properties.ClientName}");
        }
    }

    public void Disconnect() {
        _session.Disconnect();
        ContextFactory.Instance.Cleanup();
        isConnected = false;
    }

    public void Subscribe(string topicName) {
        var topic = ContextFactory.Instance.CreateTopic(topicName);
        var rc =_session.Subscribe(topic, true);
        if (rc == ReturnCode.SOLCLIENT_OK) this._subscribedTopics.Add(topicName, topic);
        Log.Debug($"Subscribe RC: {rc}");
    }

    public void Unsubscribe(string topicName) {
        if (this._subscribedTopics.ContainsKey(topicName)) {
            var rc = _session.Unsubscribe(ContextFactory.Instance.CreateTopic(topicName), true);
            if (rc == ReturnCode.SOLCLIENT_OK) this._subscribedTopics.Remove(topicName);
            Log.Debug($"Unsubscribe RC: {rc}");
        }
        else {
            Log.Warning($"{topicName} has never been subscribed");
        }
    }

    public void UnsubscribeAll() {
        var taskCount = 0;
        foreach (var topicName in _subscribedTopics.Keys) {
            // If this is the last element, than we should wait for confirmation to make sure all elements are processed
            var waitForConfirmation = (_subscribedTopics.Count <= 1);
            var rc = _session.Unsubscribe(ContextFactory.Instance.CreateTopic(topicName), waitForConfirmation);
            if (rc == ReturnCode.SOLCLIENT_OK) this._subscribedTopics.Remove(topicName);
            taskCount++;
            Log.Debug($"Unsubscribe RC: {rc}");
        }
        Log.Debug($"Unsubscribed {taskCount} topics.");
    }

    public void BindQueue(string queueName) {
        var queue = ContextFactory.Instance.CreateQueue(queueName);
        var flowProps = new FlowProperties() {
            AckMode = MessageAckMode.AutoAck,
            BindBlocking = true
        };
        try {
            var flow = this._session.CreateFlow(flowProps, queue, null, guaranteedMessageEventHandler, flowEventHandler);
            var rc = flow.Start();
            this._bindedQueues.Add(queueName, flow);
            Log.Debug($"Bind RC: {rc}");
        }
        catch (Exception ex) {
            Log.Error(ex.Message);
        }
    }

    public void UnbindQueue(string queueName) {
        if (this._bindedQueues.ContainsKey(queueName)) {
            var flow = this._bindedQueues[queueName];
            try {
                var rc = flow.Stop();
                flow.Dispose();
                this._bindedQueues.Remove(queueName);
                Log.Debug($"Unbind RC: {rc}");
            }
            catch (Exception ex) {
                Log.Error(ex.Message);
            }
        }
    }

    public void UnbindAll() {
        var taskCount = 0;
        foreach (var queueName in _bindedQueues.Keys) {
            var flow = this._bindedQueues[queueName];
            try {
                var rc = flow.Stop();
                flow.Dispose();
                this._bindedQueues.Remove(queueName);
                taskCount++;
                Log.Debug($"Unbind RC: {rc}");
            }
            catch (Exception ex) {
                Log.Error(ex.Message);
            }
        }
        Log.Debug($"Unbinded {taskCount} queues.");
    }

    public void clearAllSubsAndBinds() {
        UnsubscribeAll();
        UnbindAll();
    }

    public void Publish(string topicName, string msgText) {
        // Create the message
        using (IMessage message = ContextFactory.Instance.CreateMessage()) {
            message.Destination = ContextFactory.Instance.CreateTopic(topicName);
            message.DeliveryMode = MessageDeliveryMode.Direct;
            // Create the message content as a binary attachment
            message.BinaryAttachment = Encoding.ASCII.GetBytes(msgText);

            // Publish the message to the topic on the Solace messaging router
            Log.Debug($"Publishing to {topicName}");
            ReturnCode returnCode = _session.Send(message);
            if (returnCode != ReturnCode.SOLCLIENT_OK) {
                Log.Warning("Publishing failed, return code: {0}", returnCode);
            }
        }
    }

    public void Publish(string topicName, string msgText, bool isElidingEligible, bool isDMQEligible) {
        // Create the message
        using (IMessage message = ContextFactory.Instance.CreateMessage()) {
            message.Destination = ContextFactory.Instance.CreateTopic(topicName);
            message.DeliveryMode = MessageDeliveryMode.Direct;
            message.ElidingEligible = isElidingEligible;
            message.DMQEligible = isDMQEligible;
            // Create the message content as a binary attachment
            message.BinaryAttachment = Encoding.ASCII.GetBytes(msgText);

            // Publish the message to the topic on the Solace messaging router
            Log.Debug($"Publishing to {topicName}");
            ReturnCode returnCode = _session.Send(message);
            if (returnCode != ReturnCode.SOLCLIENT_OK) {
                Log.Warning("Publishing failed, return code: {0}", returnCode);
            }
        }
    }

    public void Reply(IMessage reqMsg, string msgText) {
        // Create the message
        using (IMessage message = ContextFactory.Instance.CreateMessage()) {
            // message.Destination = ContextFactory.Instance.CreateTopic(topicName);
            message.DeliveryMode = MessageDeliveryMode.Direct;
            // Create the message content as a binary attachment
            message.BinaryAttachment = Encoding.ASCII.GetBytes(msgText);

            // Publish the message to the topic on the Solace messaging router
            ReturnCode returnCode = _session.SendReply(reqMsg, message);
            Log.Debug($"Reply to {reqMsg.ReplyTo.Name}");
            if (returnCode != ReturnCode.SOLCLIENT_OK) {
                Log.Warning("Publishing failed, return code: {0}", returnCode);
            }
        }
    }

    
    #region Implement IDisposable

    private bool disposedValue = false;

    protected virtual void Dispose(bool disposing) {
        if (!disposedValue) {
            if (disposing) {
                if (this._session != null) {
                    this._session.Dispose();
                    // Dispose Solace Systems Messaging API
                    ContextFactory.Instance.Cleanup();
                }
            }
            disposedValue = true;
        }
    }

    public void Dispose() {
        Dispose(true);
    }
    #endregion
}