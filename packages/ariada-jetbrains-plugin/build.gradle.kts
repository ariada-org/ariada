plugins {
  id("java")
  id("org.jetbrains.intellij.platform")
}

group = "org.ariada"
version = "0.1.0"

java {
  toolchain {
    languageVersion.set(JavaLanguageVersion.of(17))
  }
}

dependencies {
  intellijPlatform {
    intellijIdea("2024.2.5")
  }
}

intellijPlatform {
  pluginConfiguration {
    id.set("org.ariada.jetbrains")
    name.set("Ariada")
    version.set(project.version.toString())
    description.set("Runs Ariada accessibility scans from JetBrains IDEs and lists findings in a tool window.")
    ideaVersion {
      sinceBuild.set("242")
    }
  }
}

tasks {
  test {
    useJUnitPlatform()
  }
}
