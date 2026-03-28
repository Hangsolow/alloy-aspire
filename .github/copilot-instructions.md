# Copilot Instructions

This is the **Alloy MVC template** for **Optimizely CMS 12** (formerly EPiServer), running on ASP.NET Core 8. It is a learning/demo template, not a production application.

## Running the Project

**With .NET Aspire (any OS, requires Docker):**
```bash
aspire start
```
Use the **aspire skill** for all Aspire operations (start, stop, status, logs, dashboard). `aspire start` launches the AppHost, opens the dashboard, and starts all resources including SQL Server. Data persists in `App_Data/`.

**Without Docker (Windows):**
```bash
dotnet run
```
Requires SQL Server LocalDB. Set `ConnectionStrings:EPiServerDB` in `appsettings.Development.json`.

There are no automated tests in this project.

## Browser Automation (playwright-cli)

When using `playwright-cli` to take screenshots or save snapshots, always save files to the `.playwright/` folder instead of the project root:

```bash
playwright-cli screenshot --filename=.playwright/my-screenshot.png
playwright-cli snapshot --filename=.playwright/my-snapshot.yaml
```

This folder is git-ignored.

## Architecture

The app follows the **Optimizely CMS MVC pattern**: content types are C# classes whose properties become editor UI fields, rendered via controllers and Razor views.

The full stack for any page type looks like:
1. **Model** (`Models/Pages/`) — `SitePageData` subclass with `[ContentType]` + `[Display]` properties
2. **Controller** (`Controllers/`) — `PageControllerBase<T>` subclass with an `Index(T currentPage)` action
3. **ViewModel** — wraps `CurrentPage` + `LayoutModel` using `PageViewModel.Create(currentPage)`
4. **View** (`Views/<PageTypeName>/Index.cshtml`) — inherits `AlloyPageBase<PageViewModel<T>>`

Blocks follow the same pattern without controllers: `SiteBlockData` subclass → partial view in `Views/Shared/Blocks/` (or a `ViewComponent` in `Components/` for complex ones).

## Key Base Classes

Every type in the project extends one of these — always maintain this hierarchy:

| Type | Base class | Location |
|------|-----------|----------|
| All page types | `SitePageData` | `Models/Pages/SitePageData.cs` |
| All block types | `SiteBlockData` | `Models/Blocks/SiteBlockData.cs` |
| All page controllers | `PageControllerBase<T>` | `Controllers/PageControllerBase.cs` |
| All Razor views | `AlloyPageBase<TModel>` | `Views/AlloyPageBase.cs` |

## Content Type Conventions

Use `[SiteContentType]` (not the raw `[ContentType]`) for pages — it automatically sets the default `GroupName`:

```csharp
[SiteContentType(GUID = "unique-guid-here")]
[SiteImageUrl]  // uses default thumbnail; pass a path to override
public class MyPage : SitePageData
{
    [Display(GroupName = SystemTabNames.Content, Order = 310)]
    [CultureSpecific]
    public virtual XhtmlString MainBody { get; set; }
}
```

Use `Globals.GroupNames.*` constants for `GroupName` on `[Display]` attributes. Use `Globals.ContentAreaTags.*` for content area display option tags. Both are defined in `Globals.cs`.

Properties that should vary per language need `[CultureSpecific]`.

## Controllers

Controller action methods receive the current page via parameter injection (Optimizely routing handles this):

```csharp
public class MyPageController : PageControllerBase<MyPage>
{
    public IActionResult Index(MyPage currentPage)
    {
        var model = PageViewModel.Create(currentPage);
        return View(model);
    }
}
```

To wire inline editing connections between ViewModel and page properties:
```csharp
var editHints = ViewData.GetEditHints<PageViewModel<MyPage>, MyPage>();
editHints.AddConnection(m => m.Layout.Logotype, p => p.SiteLogotype);
```

## Views

All views must inherit from `AlloyPageBase<T>`. For content area rendering, pass `OnItemRendered` so Bootstrap CSS classes are applied from display options:

```cshtml
@inherits alloy_aspire.Views.AlloyPageBase<PageViewModel<MyPage>>

<div epi-property="@Model.CurrentPage.MainContentArea" class="row">
    <div epi-property-item class="block" epi-on-item-rendered="OnItemRendered" />
</div>
```

Block partial views live in `Views/Shared/Blocks/`. The view filename must match the class name (e.g., `EditorialBlock.cshtml` for `EditorialBlock`). Non-standard name mappings are registered in `Business/Rendering/TemplateCoordinator.cs`.

## Registering New Services

Add DI registrations to `Extensions/ServiceCollectionExtensions.cs` in the `AddAlloy()` extension method, not directly in `Startup.cs`.

## Display Options and CSS

`ContentAreaTags` values map to Bootstrap grid classes via `AlloyContentAreaItemRenderer`:

| Tag constant | CSS classes |
|---|---|
| `FullWidth` | `col-12` |
| `WideWidth` | `col-12 col-md-8` |
| `HalfWidth` | `col-12 col-sm-6` |
| `NarrowWidth` | `col-12 col-sm-6 col-md-4` |

## NuGet Sources

The project requires the Optimizely package feed. `nuget.config` already includes it:
```
https://api.nuget.optimizely.com/v3/index.json
```
