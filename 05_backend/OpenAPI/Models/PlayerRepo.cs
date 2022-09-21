using Microsoft.OpenApi.Services;
using Serilog;

namespace OpenAPI.Models; 

public class PlayerRepo {
    private Stack<BaseRole> availableRoles;
    private List<BaseRole> occupiedRoles;
    private List<string> registeredRoleIds;
    public string nameRequestor { get; set; } // This is only for Requstor since it will be automatically generated once there is no available roles.

    public PlayerRepo() {
        this.availableRoles = new Stack<BaseRole>();
        this.occupiedRoles = new List<BaseRole>();
        this.registeredRoleIds = new List<string>();
    }

    public int getAvailableRolesCount() {
        return this.availableRoles.Count;
    }

    public int getOccupiedRolesCount() {
        return this.occupiedRoles.Count;
    }

    public int addRole(BaseRole role) {
        this.availableRoles.Push(role);
        return this.availableRoles.Count;
    }

    public BaseRole occupyRole() {
        BaseRole currRole = null;
        if (this.availableRoles.Count > 0) {
            currRole = this.availableRoles.Pop();
            currRole.id = Guid.NewGuid().ToString()[^6..];
            this.occupiedRoles.Add(currRole);
        }
        return currRole;
    }

    public BaseRole occupyRole(string id) {
        BaseRole currRole = null;
        // If the id is used, then return null, it also means there is error.
        if (this.registeredRoleIds.Contains(id)) return currRole;
        // If there are still roles in availableRoles, use it.
        if (this.availableRoles.Count > 0) {
            currRole = this.availableRoles.Pop();
        }
        else {
            // If there is no role left, we assign Requestor as default role to player.
            Log.Warning($"No available role, assiging RequestorRole as default");
            currRole = new RequestorRole(nameRequestor);
        }
        currRole.id = id;
        this.occupiedRoles.Add(currRole);
        this.registeredRoleIds.Add(id);

        return currRole;
    }

    
    public List<BaseRole> getOccupiedRoles() {
        return this.occupiedRoles;
    }

    public List<BaseRole> getAvailableRoles() {
        return this.availableRoles.ToList();
    }

    public void init() {
        this.availableRoles.Clear();
        this.occupiedRoles.Clear();
    }
}