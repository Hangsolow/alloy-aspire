using System.Text;

namespace alloy_docker.Helpers;

/// <summary>
/// Injects the audience search enhancer CSS and JS into the Optimizely CMS shell HTML response.
/// Only buffers HTML responses; binary/compressed responses are passed through unmodified.
/// </summary>
public class AudienceEnhancerMiddleware
{
    private readonly RequestDelegate _next;
    private const string InjectedTag =
        "<link rel=\"stylesheet\" href=\"/audience-enhancer/audience-enhancer.css\">" +
        "<script src=\"/audience-enhancer/audience-enhancer.js\" defer></script>";

    public AudienceEnhancerMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task Invoke(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Only consider HTML navigation requests (browser page loads, not XHR/API/static)
        // Browser page requests send Accept: text/html,... — API/script requests send */*, application/json, etc.
        if (!path.StartsWith("/EPiServer/", StringComparison.OrdinalIgnoreCase) ||
            !AcceptsHtml(context))
        {
            await _next(context);
            return;
        }

        var originalBody = context.Response.Body;
        using var buffered = new MemoryStream();
        context.Response.Body = buffered;

        await _next(context);

        buffered.Seek(0, SeekOrigin.Begin);
        context.Response.Body = originalBody;

        var contentType = context.Response.ContentType ?? string.Empty;
        var contentEncoding = context.Response.Headers.ContentEncoding.ToString();
        var isHtml = contentType.Contains("text/html", StringComparison.OrdinalIgnoreCase);
        var isCompressed = !string.IsNullOrEmpty(contentEncoding)
                           && !contentEncoding.Equals("identity", StringComparison.OrdinalIgnoreCase);

        if (isHtml && !isCompressed)
        {
            var responseBody = await new StreamReader(buffered, Encoding.UTF8).ReadToEndAsync();
            if (responseBody.Contains("</head>", StringComparison.OrdinalIgnoreCase))
            {
                responseBody = responseBody.Replace("</head>", InjectedTag + "</head>",
                    StringComparison.OrdinalIgnoreCase);
            }
            var bytes = Encoding.UTF8.GetBytes(responseBody);
            context.Response.ContentLength = bytes.Length;
            await context.Response.Body.WriteAsync(bytes);
        }
        else
        {
            // Write buffered bytes back unmodified (binary-safe copy)
            await buffered.CopyToAsync(context.Response.Body);
        }
    }

    private static bool AcceptsHtml(HttpContext context)
    {
        var accept = context.Request.Headers.Accept.ToString();
        // Only intercept explicit HTML requests (browser navigation), not API/script/image fetches
        return accept.Contains("text/html", StringComparison.OrdinalIgnoreCase);
    }
}
