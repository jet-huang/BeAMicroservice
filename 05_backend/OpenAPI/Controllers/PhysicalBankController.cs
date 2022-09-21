using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using OpenAPI.Services;
using OpenTelemetry.Context.Propagation;
using SolaceSystems.Solclient.Messaging;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenTelemetry;

namespace OpenAPI.Controllers; 

[ApiController]
[Route("api/[controller]")]
public class PhysicalBankController : ControllerBase {
    private readonly ILogger<PhysicalBankController> _logger;
    private ActivitySource _source;
    private PSPMessagingService _psp;
    // private static readonly ActivitySource Activity = new(nameof(PublishMessageController));
    private static readonly TextMapPropagator Propagator = Propagators.DefaultTextMapPropagator;
    private readonly IConfiguration _config;

    
    public class PageInfo
    {
        public int totalPage { get; set; }
        public int currentPage { get; set; }
        public int totalRec { get; set; }
    }
    
    public class ATMLocation
    {
        public string Name { get; set; }
        public string Addr { get; set; }
        public string ServiceType { get; set; } = "ATM";
        /*
        public string AddressEng { get; set; }
        public string remark { get; set; }
        public string GoogleMapAddress { get; set; }
        */
    }
    
    public class ComplementFoldingLocation
    {
        public string Name { get; set; }
        public string Addr { get; set; }
        public string ServiceType { get; set; } = "補摺機";
        /*
        public string GoogleMapAddress { get; set; }
        public string Memo { get; set; }
        // public List<Condition> Condition { get; set; }
        */
    }
    public class BranchLocation
    {
        public string Name { get; set; }
        public string Addr { get; set; }
        public string ServiceType { get; set; } = "實體分行";
        /*
        public string Name_En { get; set; }
        public string Addr_En { get; set; }
        public string GoogleMapAddress { get; set; }
        public string Tel { get; set; }
        public string Fax { get; set; }
        public string Code { get; set; }
        public string swift { get; set; }
        public string Longitude { get; set; }
        public string Latitude { get; set; }
        public string IsNightService { get; set; }
        public string Memo { get; set; }
        */
        // public List<Condition> Condition { get; set; }
    }

    public PhysicalBankController(ILogger<PhysicalBankController> logger, IConfiguration config, IServiceProvider provider)
    {
        _logger = logger;
        _source = new ActivitySource("PhysicalBankController", "1.0.0");
        _config = config;
        _psp = provider.GetRequiredService<PSPMessagingService>();
        _psp.Connect();
    }
    private void AddActivityToHeader(Activity activity, SessionProperties props)
    {
        Propagator.Inject(new PropagationContext(activity.Context, Baggage.Current), props, InjectContextIntoHeader);
        activity?.SetTag("messaging.system", "solace");
        activity?.SetTag("messaging.destination_kind", "queue");
        activity?.SetTag("messaging.solace.queue", "q");
    }
    
    private void InjectContextIntoHeader(SessionProperties props, string key, string value)
    {
        try
        {
            _logger.LogInformation(props.Host);
            /*
            props.Headers ??= new Dictionary<string, object>();
            props.Headers[key] = value;
            */
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to inject trace context.");
        }
    }

    private void publishMessage(string msg) {
        using (Activity activity = _source.StartActivity("Solace Publish", ActivityKind.Producer)) {
            AddActivityToHeader(activity, _psp.sessionProps);
            _psp.PublishMessage(msg);
            activity.SetStatus(ActivityStatusCode.Ok);
        }
    }

    private async Task<int> fetchTotalPages(string apiUrl) {
        using (var http = new HttpClient()) {
            // Get first page to know how many pages there
            var response = await http.GetAsync(apiUrl);
            var resultJson = await response.Content.ReadAsStringAsync();
            var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(resultJson);
            var pageInfo = JsonSerializer.Deserialize<PageInfo>(obj["pageInfo"].ToString());
            return pageInfo.totalPage;
        }
    }
    
    private async Task<string> fetchFromWeb(string apiUrlTemplate, string cityId) {
        using (var http = new HttpClient()) {
            // Get first page to know how many pages there
            int currentPage = 1;
            string apiUrl = string.Format(apiUrlTemplate, currentPage, cityId);
            int totalPages = await fetchTotalPages(apiUrl);
            List<object> lResult = new List<object>();
            for (int i = 0; i < totalPages; i++) {
                currentPage = i + 1;
                apiUrl = string.Format(apiUrlTemplate, currentPage, cityId);
                var response = await http.GetAsync(apiUrl);
                var resultJson = await response.Content.ReadAsStringAsync();
                var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(resultJson);
                var tmpObj = JsonSerializer.Deserialize<List<object>>(obj["locations"].ToString());
                lResult.AddRange(tmpObj);
                await Task.Delay((new Random().Next(222, 333)));
            }
            // _logger.LogInformation(JsonSerializer.Serialize(lResult));
            publishMessage($"Got {lResult.Count} records from {apiUrl}");
            // _psp.Disconnect();
            return JsonSerializer.Serialize(lResult);
        }
    }

    private async Task<List<ATMLocation>> fetchAtmLocations(string cityId) {
        _logger.LogInformation(message: $"Search ATMs in city ID: {cityId}");
        using (Activity activity = _source.StartActivity("fetchAtmLocations")) {
            string apiUrlTemplate = "https://www.skbank.com.tw/skbank_web/data?action=atmList&page={0}&city_id={1}&ZipCode=&Address=";
            var resultJson = await fetchFromWeb(apiUrlTemplate, cityId);
            var myList = JsonSerializer.Deserialize<List<ATMLocation>>(resultJson);
            return myList;
        }
    }

    private async Task<List<BranchLocation>> fetchBranchLocations(string cityId) {
        _logger.LogInformation(message: $"Search branches in city ID: {cityId}");
        using (Activity activity = _source.StartActivity("fetchBranchLocations")) {
            string apiUrlTemplate = "https://www.skbank.com.tw/skbank_web/data?action=skbankList&page={0}&city_id={1}&ZipCode=&Address=&IsNightService=&IsSafeBox=";
            var resultJson = await fetchFromWeb(apiUrlTemplate, cityId);
            var myList = JsonSerializer.Deserialize<List<BranchLocation>>(resultJson);
            return myList;
        }
    }

    private async Task<List<ComplementFoldingLocation>> fetchComplementFoldingLocations(string cityId) {
        _logger.LogInformation(message: $"Search complement folding machines in city ID: {cityId}");
        using (Activity activity = _source.StartActivity("fetchComplementFoldingLocations")) {
            var apiUrlTemplate = "https://www.skbank.com.tw/skbank_web/data?action=complementFoldingList&page={0}&city_id={1}&ZipCode=&Address=&Allday=";
            var resultJson = await fetchFromWeb(apiUrlTemplate, cityId);
            var myList = JsonSerializer.Deserialize<List<ComplementFoldingLocation>>(resultJson);
            return myList;
        }
    }

    [HttpGet("{cityId}")]
    public async Task<List<object>> GetLocalBankServices(string cityId) {
        List<object> lResult = new List<object>();
        lResult.AddRange(await fetchAtmLocations(cityId));
        lResult.AddRange(await fetchBranchLocations(cityId));
        lResult.AddRange(await fetchComplementFoldingLocations(cityId));
        /*
        Dictionary<string, object> dResult = new Dictionary<string, object>();
        dResult.Add("ATM", );
        dResult.Add("分行", await fetchBranchLocations(cityId));
        dResult.Add("補摺機", await fetchComplementFoldingLocations(cityId));
        return dResult;
        */
        return lResult;
    }

    [HttpGet("branch/{cityId}")]
    public async Task<List<BranchLocation>> GetBranches(string cityId) {
        return await fetchBranchLocations(cityId);
    }

    [HttpGet("atm/{cityId}")]
    public async Task<List<ATMLocation>> GetATMs(string cityId) {
        return await fetchAtmLocations(cityId);
    }

    [HttpGet("cf/{cityId}")]
    public async Task<List<ComplementFoldingLocation>> GetCFs(string cityId) {
        return await fetchComplementFoldingLocations(cityId);
    }

    [HttpGet("LocalBank")]
    public async Task<List<BranchLocation>> test2() {
        _logger.LogInformation(message: "Search local bank...");
        var apiUrl =
            "https://www.skbank.com.tw/skbank_web/data?action=skbankList&page=1&city_id=07&ZipCode=&Address=&IsNightService=&IsSafeBox=";
        using (var http = new HttpClient())
        {
            var response = await http.GetAsync(apiUrl);
            var resultJson = await response.Content.ReadAsStringAsync();
            var obj = JsonSerializer.Deserialize<Dictionary<string, object>>(resultJson);
            //var locations = "{" + obj["locations"] + "}";
            var myList = JsonSerializer.Deserialize<List<BranchLocation>>(obj["locations"].ToString());
            // _logger.LogInformation(resultJson);
            return myList;
        }
    }
}