var builder = DistributedApplication.CreateBuilder(args);

var sqlPassword = builder.AddParameter("sql-password", secret: true);

var sql = builder.AddSqlServer("sql", password: sqlPassword)
    .WithDataBindMount(Path.Combine(builder.AppHostDirectory, "..", "App_Data"))
    .WithLifetime(ContainerLifetime.Persistent);

var db = sql.AddDatabase("EPiServerDB", "alloy-docker");

builder.AddProject<Projects.alloy_docker>("web")
    .WithReference(db)
    .WaitFor(db);

builder.Build().Run();
