var builder = DistributedApplication.CreateBuilder(args);

var sqlPassword = builder.AddParameter("sql-password", secret: true);

var sql = builder.AddSqlServer("sql", password: sqlPassword)
    .WithDataBindMount(Path.Combine(builder.AppHostDirectory, "..", "App_Data"))
    .WithLifetime(ContainerLifetime.Persistent);

var db = sql.AddDatabase("EPiServerDB", "alloy-aspire");

builder.AddProject<Projects.alloy_aspire>("web")
    .WithReference(db)
    .WaitFor(db);

builder.Build().Run();
