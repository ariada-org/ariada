plugins {
  java
  id("org.jetbrains.intellij.platform") version "2.16.0"
}

group = "org.ariada"
version = "0.1.0"

java {
  toolchain {
    languageVersion.set(JavaLanguageVersion.of(17))
  }
}

repositories {
  mavenCentral()
  intellijPlatform {
    defaultRepositories()
    jetbrainsRuntime()
  }
}

dependencies {
  intellijPlatform {
    intellijIdeaCommunity("2024.3.6") {
      useInstaller = false
    }
    jetbrainsRuntime()
  }

  testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
  testRuntimeOnly("junit:junit:4.13.2")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile>().configureEach {
  options.release.set(17)
}

tasks.test {
  useJUnitPlatform()
}
