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

  // Bundled, not borrowed. The report reader needs a JSON parser, and the one
  // that satisfied the compiler came in through the build's own tooling rather
  // than from the IDE: searched jar by jar, no distribution of IntelliJ IDEA
  // 2024.2.5 carries com.google.gson at all. Code compiled against it would have
  // passed every check here and thrown NoClassDefFoundError the first time a
  // person ran a site scan.
  implementation("com.google.code.gson:gson:2.11.0")

  // The package shipped with no test dependency and no tests, so the checks it
  // does have could not be run at all — the in-editor scan's own guard came from
  // the other implementation of this plugin and had nowhere to live here.
  testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

intellijPlatform {
  pluginConfiguration {
    id.set("org.ariada.jetbrains")
    name.set("Ariada Accessibility")
    version.set(project.version.toString())
    description.set(
      "Checks the open file's markup, or runs the Ariada scanner against a running site, "
        + "and lists what each one found in a tool window.")
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
