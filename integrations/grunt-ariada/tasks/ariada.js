// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/** Register the Ariada HTML scan multi-task on a Grunt instance. */
export function registerAriadaTask(grunt, scanner = defaultScanner) {
  grunt.registerMultiTask('ariada', 'Scan HTML files with Ariada accessibility checks.', function ariadaTask() {
    const done = this.async();
    const options = this.options({ failOnFindings: true });

    void (async () => {
      try {
        const results = await Promise.all(
          this.filesSrc.map(async (filePath) => {
            const html = grunt.file.read(filePath);
            return { filePath, findings: await scanner({ filePath, html }) };
          }),
        );
        const count = results.reduce((sum, result) => sum + result.findings.length, 0);
        if (count > 0 && options.failOnFindings) {
          grunt.fail.warn(`Ariada Grunt gate failed with ${count} finding(s).`);
        }
        done();
      } catch (error) {
        done(error);
      }
    })();
  });
}

export default registerAriadaTask;

function defaultScanner() {
  return [];
}
