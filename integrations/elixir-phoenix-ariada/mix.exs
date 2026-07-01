defmodule AriadaPhoenix.MixProject do
  use Mix.Project

  def project do
    [
      app: :ariada_phoenix,
      version: "0.1.0",
      elixir: "~> 1.16",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      package: package(),
      description: "Phoenix mix task that delegates accessibility scans to @ariada-org/cli",
      docs: [
        main: "readme",
        extras: ["README.md"]
      ]
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp deps do
    [
      {:jason, "~> 1.4"},
      {:ex_doc, "~> 0.34", only: :dev, runtime: false}
    ]
  end

  defp package do
    [
      licenses: ["EUPL-1.2"],
      links: %{
        "Ariada" => "https://github.com/ariada-org/ariada",
        "Phoenix" => "https://www.phoenixframework.org/",
        "Hex" => "https://hex.pm/"
      },
      files: ~w(lib mix.exs README.md .formatter.exs)
    ]
  end
end
