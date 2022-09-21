using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;

namespace OpenAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DemoController : ControllerBase {
    private readonly ILogger<PhysicalBankController> _logger;
    private ActivitySource _source;

    public DemoController(ILogger<PhysicalBankController> logger) {
        _logger = logger;
        _source = new ActivitySource("DemoController", "1.0.0");
    }
    
    [HttpGet]
    public async Task<Dictionary<string, object>> doTask01() {
        var myJsonOptions = new JsonSerializerOptions() {
            WriteIndented = true
        };
        Dictionary<string, object> dResult;
        var actName = $"{Request.Method.ToUpper()} {Request.Path}";
        _logger.LogInformation(message: "Running [GET] on DemoController");
        var delayNum = (new Random().Next(555, 999));
        dResult = new Dictionary<string, object>() {
            ["status"] = "success",
            ["elapsedTime"] = delayNum
        };
        await Task.Delay(delayNum);
        return dResult;
    }
}