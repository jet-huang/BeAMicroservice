using OpenAPI.Services;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenAPI.Models;
using System.Diagnostics;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

var runtimeConfig = new RuntimeConfig();
builder.Configuration.GetSection("RuntimeConfig").Bind(runtimeConfig);
Console.WriteLine($"Runtime Config: {runtimeConfig.solaceConfig.hostUrl}");

// Add services to the container.
builder.Services.AddOpenTelemetryTracing(b => {
    b.SetResourceBuilder(
            ResourceBuilder.CreateDefault().AddService(builder.Environment.ApplicationName))
        //ResourceBuilder.CreateDefault().AddService("solbroker"))
        .AddSource("PhysicalBankController")
        .AddSource("DemoController")
        .AddSource("GameMakerController")
        .AddHttpClientInstrumentation()
        .AddAspNetCoreInstrumentation()
        //.AddConsoleExporter()
        .AddOtlpExporter(opts => { opts.Endpoint = new Uri(runtimeConfig.exporterUrl); });
    //.AddOtlpExporter(opts => { opts.Endpoint = new Uri("http://footprint.jbls.tw:4317"); });
});

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options => {
    options.AddDefaultPolicy(
        b => {
            b.AllowAnyHeader();
            b.AllowAnyOrigin();
            b.AllowAnyMethod();
        });
});
builder.Services.AddSingleton<PSPMessagingService>(x => {
    // var sConfig = builder.Configuration.GetSection("solace");
    return new PSPMessagingService(
        runtimeConfig.solaceConfig.hostUrl, runtimeConfig.solaceConfig.vpnName,
        runtimeConfig.solaceConfig.userName, runtimeConfig.solaceConfig.password
    );
});

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .CreateLogger();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();