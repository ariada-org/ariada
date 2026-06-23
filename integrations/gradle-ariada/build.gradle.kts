plugins {
    `java-gradle-plugin`
}

group = "org.ariada"
version = "0.1.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

gradlePlugin {
    plugins {
        create("ariadaScan") {
            id = "org.ariada.scan"
            implementationClass = "org.ariada.gradle.AriadaScanPlugin"
            displayName = "Ariada accessibility scan"
            description = "Runs the @ariada-org CLI from Gradle and gates the build on scan findings."
        }
    }
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}

dependencies {
    testImplementation(gradleTestKit())
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
