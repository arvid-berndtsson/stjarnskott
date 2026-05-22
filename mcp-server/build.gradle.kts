import java.time.Instant

abstract class EmbedProxyJarTask : DefaultTask() {
    @get:InputFile
    abstract val shadowJarFile: RegularFileProperty

    @get:InputDirectory
    abstract val projectDir: DirectoryProperty

    @get:InputFile
    abstract val proxyJarFile: RegularFileProperty

    @get:Inject
    abstract val execOperations: ExecOperations

    @TaskAction
    fun embedJar() {
        val shadowJar = shadowJarFile.get().asFile
        val proxyJar = proxyJarFile.get().asFile
        val generatedProxyDir = proxyJar.parentFile

        if (!proxyJar.exists()) {
            throw GradleException("Proxy JAR not found at: ${proxyJar.absolutePath}")
        }

        execOperations.exec {
            workingDir(projectDir.get().asFile)
            commandLine("jar", "uf", shadowJar.absolutePath, "-C", generatedProxyDir.absolutePath, proxyJar.name)
        }

        logger.lifecycle("Embedded proxy JAR ${proxyJar.name} into ${shadowJar.name}")
    }
}

abstract class StageProxyJarTask : DefaultTask() {
    @get:InputDirectory
    abstract val proxyLibsDir: DirectoryProperty

    @get:OutputFile
    abstract val stagedProxyJar: RegularFileProperty

    @TaskAction
    fun stageJar() {
        val libsDir = proxyLibsDir.get().asFile
        val stagedJar = stagedProxyJar.get().asFile
        val candidates = libsDir
            .listFiles { file -> file.isFile && file.name.endsWith("all.jar") }
            ?.sortedByDescending { it.lastModified() }
            .orEmpty()

        val selectedJar = candidates.firstOrNull()
            ?: throw GradleException("No proxy shadow jar matching *all.jar found in ${libsDir.absolutePath}")

        stagedJar.parentFile.mkdirs()
        selectedJar.copyTo(stagedJar, overwrite = true)

        logger.lifecycle("Staged proxy JAR from ${selectedJar.name} to ${stagedJar.absolutePath}")
    }
}

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ktor)
    java
}

group = providers.gradleProperty("group").get()
version = providers.gradleProperty("version").get()
description = providers.gradleProperty("description").get()

dependencies {
    compileOnly(libs.burp.montoya.api)

    implementation(libs.bundles.ktor.server)
    implementation(libs.kotlin.stdlib)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.mcp.kotlin.sdk)

    testImplementation(libs.bundles.test.framework)
    testImplementation(libs.bundles.ktor.test)
    testImplementation(libs.burp.montoya.api)
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(providers.gradleProperty("java.toolchain.version").get().toInt()))
    }
}

kotlin {
    jvmToolchain {
        languageVersion.set(JavaLanguageVersion.of(providers.gradleProperty("java.toolchain.version").get().toInt()))
    }

    compilerOptions {
        apiVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_2)
        languageVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_2)
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
        freeCompilerArgs.addAll(
            "-Xjsr305=strict"
        )
    }
}

application {
    mainClass.set("net.portswigger.mcp.ExtensionBase")
}

val proxyIncludedBuild = gradle.includedBuild("mcp-proxy")
val generatedProxyJar = layout.buildDirectory.file("generated/proxy/mcp-proxy-all.jar")

tasks {
    register<StageProxyJarTask>("syncProxyJar") {
        group = "build"
        description = "Stages the vendored MCP proxy shadow jar into a stable generated path"
        dependsOn(proxyIncludedBuild.task(":shadowJar"))
        proxyLibsDir.set(layout.projectDirectory.dir("vendor/mcp-proxy/build/libs"))
        stagedProxyJar.set(generatedProxyJar)
    }

    test {
        useJUnitPlatform()
        systemProperty("file.encoding", "UTF-8")
        dependsOn("syncProxyJar")
        systemProperty("burp.proxyJar", generatedProxyJar.get().asFile.absolutePath)

        testLogging {
            events("passed", "skipped", "failed")
            showExceptions = true
            showCauses = true
            showStackTraces = true
        }
    }

    jar {
        enabled = false
    }

    shadowJar {
        archiveClassifier.set("")
        mergeServiceFiles()

        manifest {
            attributes(
                mapOf(
                    "Implementation-Title" to project.name,
                    "Implementation-Version" to project.version,
                    "Implementation-Vendor" to "PortSwigger",
                    "Built-By" to System.getProperty("user.name"),
                    "Built-Date" to Instant.now().toString(),
                    "Built-JDK" to "${System.getProperty("java.version")} (${System.getProperty("java.vendor")} ${
                        System.getProperty("java.vm.version")
                    })",
                    "Created-By" to "Gradle ${gradle.gradleVersion}"
                )
            )
        }


        exclude("META-INF/*.SF")
        exclude("META-INF/*.DSA")
        exclude("META-INF/*.RSA")
        exclude("META-INF/INDEX.LIST")
        exclude("META-INF/DEPENDENCIES")
        exclude("META-INF/NOTICE*")
        exclude("META-INF/LICENSE*")
        exclude("module-info.class")

        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    }

    register<EmbedProxyJarTask>("embedProxyJar") {
        group = "build"
        description = "Embeds the MCP proxy JAR into the shadow JAR"
        dependsOn(shadowJar)
        dependsOn("syncProxyJar")
        shadowJarFile.set(shadowJar.flatMap { it.archiveFile })
        proxyJarFile.set(generatedProxyJar)
        projectDir.set(layout.projectDirectory)
    }

    build {
        dependsOn(shadowJar)
    }

    withType<AbstractArchiveTask>().configureEach {
        isPreserveFileTimestamps = false
        isReproducibleFileOrder = true
    }
}

tasks.wrapper {
    gradleVersion = "9.2.0"
    distributionType = Wrapper.DistributionType.BIN
}
