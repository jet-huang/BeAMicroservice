using System.Globalization;
using System.Text;
using Microsoft.JSInterop;
using SolaceSystems.Solclient.Messaging;

namespace OpenAPI.Services;

public class PSPMessagingService {
    const int DefaultReconnectRetries = 3;
    public string VPNName { get; set; }
    public string UserName { get; set; }
    public string Password { get; set; }
    public string HostUrl { get; set; }
    public SessionProperties sessionProps;
    private readonly IContext _context;
    private SolaceSystems.Solclient.Messaging.ISession _session;
    private bool isConnected = false;


    public PSPMessagingService() {
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

    public PSPMessagingService(string hostUrl, string vpnName, string userName, string password) {
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
        sessionProps = new SessionProperties() {
            Host = HostUrl,
            VPNName = VPNName,
            UserName = UserName,
            Password = Password,
            ReconnectRetries = DefaultReconnectRetries
        };
    }

    public void Connect() {
        updateSessionProps();
        if (!isConnected) {
            // Connect to the Solace messaging router
            _session = _context.CreateSession(sessionProps, null, null);
            Console.WriteLine("Connecting as {0}@{1} on {2}...", UserName, VPNName, HostUrl);
            ReturnCode returnCode = _session.Connect();
            if (returnCode == ReturnCode.SOLCLIENT_OK) {
                isConnected = true;
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

    public void PublishMessage(string msgText) {
        // Create the message
        using (IMessage message = ContextFactory.Instance.CreateMessage()) {
            message.Destination = ContextFactory.Instance.CreateTopic("solace/tracing");
            message.DeliveryMode = MessageDeliveryMode.Direct;
            // Create the message content as a binary attachment
            message.BinaryAttachment = Encoding.ASCII.GetBytes(msgText);

            // Publish the message to the topic on the Solace messaging router
            Console.WriteLine("Publishing message...");
            ReturnCode returnCode = _session.Send(message);
            if (returnCode == ReturnCode.SOLCLIENT_OK) {
                Console.WriteLine("Done.");
            }
            else {
                Console.WriteLine("Publishing failed, return code: {0}", returnCode);
            }
        }
    }
}