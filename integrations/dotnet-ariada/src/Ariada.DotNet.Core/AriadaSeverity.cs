// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada.DotNet.Core;

public static class AriadaSeverity
{
 private static readonly IReadOnlyDictionary<string, int> Rank = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
 {
 ["minor"] = 1,
 ["moderate"] = 2,
 ["serious"] = 3,
 ["critical"] = 4,
 };

 public static bool IsAtOrAbove(string severity, string threshold)
 {
 return ValueOf(severity) >= ValueOf(threshold);
 }

 public static int ValueOf(string severity)
 {
 return Rank.TryGetValue(severity, out var value) ? value: Rank["moderate"];
 }
}

