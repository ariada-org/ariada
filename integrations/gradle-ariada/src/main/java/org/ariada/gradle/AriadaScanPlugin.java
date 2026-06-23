package org.ariada.gradle;

import org.gradle.api.Plugin;
import org.gradle.api.Project;

public final class AriadaScanPlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        AriadaScanExtension extension =
            project.getExtensions().create("ariada", AriadaScanExtension.class, project);

        project.getTasks().register("ariadaScan", AriadaScanTask.class, task -> {
            task.setGroup("verification");
            task.setDescription("Runs @ariada-org/cli against the configured URL.");
            task.getTargetUrl().convention(extension.getTargetUrl());
            task.getCliCommand().convention(extension.getCliCommand());
            task.getOutputDir().convention(extension.getOutputDir());
            task.getDomains().convention(extension.getDomains());
            task.getSeverityThreshold().convention(extension.getSeverityThreshold());
            task.getFailOnViolations().convention(extension.getFailOnViolations());
        });
    }
}
