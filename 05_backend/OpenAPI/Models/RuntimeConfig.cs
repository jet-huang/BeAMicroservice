namespace OpenAPI.Models;

public class RuntimeConfig {
    public string exporterUrl { get; set; }
    public SolaceConfig solaceConfig { get; set; }
    
    public class SolaceConfig {
        public string hostUrl { get; set; }
        public string vpnName { get; set; }
        public string userName { get; set; }
        public string password { get; set; }

        public SolaceConfig() {
        }
    }
    
    public RuntimeConfig() {
    }

    public void showConfig() {
        Console.WriteLine($"Current config: {this.exporterUrl}");
    }

    public void loadAllConfig(){
        
    }
}