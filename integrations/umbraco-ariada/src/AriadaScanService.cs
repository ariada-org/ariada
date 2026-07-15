// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada.Umbraco;

public sealed record AriadaScanRequest(string Url, string Source, IReadOnlyList<string> Domains);

public sealed class AriadaScanService
{
    public AriadaScanRequest CreateRequest(string renderedUrl)
    {
        if (!Uri.TryCreate(renderedUrl, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException("Umbraco content must resolve to an absolute rendered URL.", nameof(renderedUrl));
        }

        return new AriadaScanRequest(uri.ToString(), "umbraco.content-app", ["accessibility"]);
    }
}
