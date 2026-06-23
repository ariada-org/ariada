package org.ariada.gradle;

import org.gradle.api.Project;
import org.gradle.api.provider.Property;

public abstract class AriadaScanExtension {
 public abstract Property<String> getTargetUrl();

 public abstract Property<String> getCliCommand();

 public abstract Property<String> getOutputDir();

 public abstract Property<String> getDomains();

 public abstract Property<String> getSeverityThreshold();

 public abstract Property<Boolean> getFailOnViolations();

 public AriadaScanExtension(Project project) {
 getCliCommand().convention("ariada");
 getOutputDir().convention(project.getLayout().getBuildDirectory().dir("ariada").map(Object::toString));
 getDomains().convention("accessibility");
 getSeverityThreshold().convention("moderate");
 getFailOnViolations().convention(true);
 }
}
