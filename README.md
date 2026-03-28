# Alloy MVC template

This template should not be seen as best practices, but as a great way to learn and test Optimizely CMS. 

## How to run

Chose one of the following options to get started. 

### Windows

Prerequisities
- .NET SDK 8+
- SQL Server 2016 Express LocalDB (or later)

```bash
$ dotnet run
````

### Any OS with .NET Aspire

Prerequisities
- .NET SDK 8+
- Docker (to run the SQL Server container)

```bash
$ dotnet run --project alloy-aspire.AppHost
````

This launches the .NET Aspire dashboard and starts both the SQL Server container and the web app. The Aspire dashboard opens automatically and shows logs, traces, and resource status.

- Web app: URL is shown in the Aspire dashboard under the `web` resource
- SQL Server: exposed on port 1433 inside the Aspire environment
- Database files persist in `App_Data/` between runs

> Note: The first run creates a fresh database. Optimizely CMS provisions the schema automatically on startup.

#### Customising the SA password

The default SA password (`Qwerty12345!`) is set in `alloy-aspire.AppHost/appsettings.Development.json`. Override it for your environment using [user secrets](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets):

```bash
cd alloy-aspire.AppHost
dotnet user-secrets set "Parameters:sql-password" "<your-password>"
```

### Any OS with external database server

Prerequisities
- .NET SDK 8+
- SQL Server 2016 (or later) on a external server, e.g. Azure SQL

Create an empty database on the external database server and add the connection string to `appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "EPiServerDB": "Server=<host>;Database=alloy-aspire;User Id=<user>;Password=<password>;Encrypt=False;"
  }
}
```

```bash
$ dotnet run
````

