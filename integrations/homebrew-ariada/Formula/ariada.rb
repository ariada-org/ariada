# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2

class Ariada < Formula
  desc "Accessibility scanner CLI for WCAG and European Accessibility Act gates"
  homepage "https://github.com/ariada-org/ariada"
  url "https://registry.npmjs.org/@ariada-org/cli/-/cli-0.1.0.tgz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "EUPL-1.2"
  head "https://github.com/ariada-org/ariada.git", branch: "main"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args(prefix: libexec), cached_download
    bin.install_symlink libexec/"bin/ariada"
  end

  test do
    assert_match "ariada", shell_output("#{bin}/ariada --help")
  end
end
