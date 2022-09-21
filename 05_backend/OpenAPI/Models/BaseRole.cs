using System.Runtime.CompilerServices;
using Microsoft.OpenApi.Extensions;

namespace OpenAPI.Models;

public class BaseRole {
    private string _id;
    public string id {
        get { return this._id; }
        set {
            this._id = value;
            this.roleId = this.rolePrefix + "-" + this._id;
            this.name = this.namePrefix + "-" + this._id;
        }
    }
    public string namePrefix { get; set; }
    public string name { get; protected set; }
    public string roleId { get; protected set; }
    public string roleTypeDesc { get; protected set; }
    public string rolePrefix { get; protected set; }
    private RoleType _roleType;
    public RoleType roleType {
        get { return _roleType; }
        set {
            this._roleType = value;
            this.roleTypeDesc = this._roleType.GetDisplayName();
        }
    }
    
    public BaseRole() {
        this.namePrefix = "UNKNOWN";
        this.rolePrefix = "DEFAULT";
        this.roleType = RoleType.NO_ROLE_TYPE;
        this.id = "FFFFF_FFFFF";
    }
}

public class RequestorRole : BaseRole {
    public RequestorRole(string namePrefix) {
        this.namePrefix = namePrefix;
        init();
    }
    
    public RequestorRole() {
        init();
    }

    private void init() {
        this.rolePrefix = "R";
        this.roleType = RoleType.REQUESTOR;
        this.id = "00000_00000";
    }
}

public class ServerRole : BaseRole {
    public ServerRole(string namePrefix) {
        this.namePrefix = namePrefix;
        init();
    }
    
    public ServerRole() {
        init();
    }

    private void init() {
        this.rolePrefix = "S";
        this.roleType = RoleType.SERVER;
        this.id = "00000_00000";
    }
}

public class WatcherRole : BaseRole {
    public WatcherRole(string namePrefix) {
        this.namePrefix = namePrefix;
        init();
    }
    
    public WatcherRole() {
        init();
    }

    private void init() {
        this.rolePrefix = "W";
        this.roleType = RoleType.WATCHER;
        this.id = "00000_00000";
    }
}