// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

public final class StaticSiteServer implements AutoCloseable {
  private final HttpServer server;
  private final Path root;

  private StaticSiteServer(HttpServer server, Path root) {
    this.server = server;
    this.root = root;
  }

  public static StaticSiteServer start(Path root) throws IOException {
    Path normalizedRoot = root.toAbsolutePath().normalize();
    if (!Files.isDirectory(normalizedRoot)) {
      throw new IOException("Static site directory does not exist: " + normalizedRoot);
    }
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    StaticSiteServer wrapper = new StaticSiteServer(server, normalizedRoot);
    server.createContext("/", exchange -> {
      URI uri = exchange.getRequestURI();
      String rawPath = uri.getPath() == null || uri.getPath().isBlank() ? "/" : uri.getPath();
      Path candidate = normalizedRoot.resolve(rawPath.substring(1)).normalize();
      if (!candidate.startsWith(normalizedRoot)) {
        exchange.sendResponseHeaders(403, -1);
        exchange.close();
        return;
      }
      if (Files.isDirectory(candidate)) {
        candidate = candidate.resolve("index.html");
      }
      if (!Files.isRegularFile(candidate)) {
        exchange.sendResponseHeaders(404, -1);
        exchange.close();
        return;
      }
      byte[] body = Files.readAllBytes(candidate);
      exchange.getResponseHeaders().set("Content-Type", contentType(candidate));
      exchange.sendResponseHeaders(200, body.length);
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(body);
      }
    });
    server.start();
    return wrapper;
  }

  public String url() {
    return "http://127.0.0.1:" + server.getAddress().getPort() + "/";
  }

  @Override
  public void close() {
    server.stop(0);
  }

  private static String contentType(Path file) {
    String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
    if (name.endsWith(".html") || name.endsWith(".htm")) {
      return "text/html; charset=utf-8";
    }
    if (name.endsWith(".css")) {
      return "text/css; charset=utf-8";
    }
    if (name.endsWith(".js")) {
      return "text/javascript; charset=utf-8";
    }
    return "application/octet-stream";
  }
}
