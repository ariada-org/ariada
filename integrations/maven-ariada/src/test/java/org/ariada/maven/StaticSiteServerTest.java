// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class StaticSiteServerTest {
 @TempDir
 Path tempDir;

 @Test
 void servesIndexHtmlFromStaticDirectory() throws Exception {
 Files.writeString(tempDir.resolve("index.html"), "<!doctype html><title>Ariada</title>");
 try (StaticSiteServer server = StaticSiteServer.start(tempDir)) {
 HttpResponse<String> response = HttpClient.newHttpClient().send(
 HttpRequest.newBuilder(URI.create(server.url())).GET().build(),
 HttpResponse.BodyHandlers.ofString());

 assertEquals(200, response.statusCode());
 assertTrue(response.body().contains("Ariada"));
 }
 }
}
