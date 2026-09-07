<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * English language strings.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
$string['allowprivate'] = 'Allow private-network targets';
$string['allowprivate_desc'] = 'Pass --allow-private to Ariada. Targets remain restricted to this Moodle origin.';
$string['ariada:scan'] = 'Queue Ariada scans for course pages';
$string['ariada:view'] = 'View Ariada reports in a course';
$string['ariada:viewall'] = 'View Ariada reports for all courses';
$string['browserpath'] = 'Playwright browser path';
$string['browserpath_desc'] = 'Optional absolute PLAYWRIGHT_BROWSERS_PATH containing pre-provisioned Chromium. The plugin never downloads browsers.';
$string['cannotreadreport'] = 'The stored Ariada report is invalid or unreadable.';
$string['clierror'] = 'Ariada could not complete the scan: {$a}';
$string['course'] = 'Course';
$string['details'] = 'Full report';
$string['en301549'] = 'EN 301 549';
$string['findingcount'] = 'Findings';
$string['intro'] = 'Ariada scans rendered course-page URLs with the bundled OSS CLI and stores WCAG and EN 301 549 findings in Moodle.';
$string['message'] = 'Finding';
$string['nodebinary'] = 'Node.js executable';
$string['nodebinary_desc'] = 'Node.js 22 or newer. Use an absolute path when cron has a restricted PATH.';
$string['nofindings'] = 'No findings were reported.';
$string['noreports'] = 'No Ariada scans have been queued for this scope.';
$string['pageurl'] = 'Course-page URL';
$string['pageurl_help'] = 'The URL must use HTTP or HTTPS and have exactly the same origin as this Moodle site.';
$string['pluginname'] = 'Ariada accessibility reports';
$string['privacy:metadata:scan'] = 'Ariada scan requests and reports associated with a requesting user.';
$string['privacy:metadata:scan:courseid'] = 'The course whose rendered page was scanned.';
$string['privacy:metadata:scan:pageurl'] = 'The same-origin Moodle page URL submitted for scanning.';
$string['privacy:metadata:scan:reportjson'] = 'The accessibility report returned by the Ariada CLI.';
$string['privacy:metadata:scan:timecreated'] = 'The time at which the scan was requested.';
$string['privacy:metadata:scan:userid'] = 'The user who requested the scan.';
$string['privacy:path'] = 'Ariada accessibility scans';
$string['reportfor'] = 'Ariada reports for {$a}';
$string['rule'] = 'Rule';
$string['runtimeblocked'] = 'The packaged Ariada runtime is missing. Install the production ZIP, not the source directory.';
$string['scanpage'] = 'Scan course page';
$string['scanqueued'] = 'The Ariada scan was queued. Moodle cron will update this report.';
$string['selector'] = 'Target';
$string['settings'] = 'Ariada settings';
$string['severity'] = 'Failure threshold';
$string['severitycritical'] = 'Critical';
$string['severityminor'] = 'Minor';
$string['severitymoderate'] = 'Moderate';
$string['severityserious'] = 'Serious';
$string['severitythreshold'] = 'Default failure threshold';
$string['severitythreshold_desc'] = 'All findings are retained; this controls Ariada\'s violation exit threshold.';
$string['status'] = 'Status';
$string['statuscompleted'] = 'Completed';
$string['statusfailed'] = 'Failed';
$string['statusqueued'] = 'Queued';
$string['statusrunning'] = 'Running';
$string['taskrunscan'] = 'Run queued Ariada course-page scan';
$string['timecreated'] = 'Requested';
$string['timeoutms'] = 'Navigation timeout (milliseconds)';
$string['timeoutms_desc'] = 'Per-page timeout from 5,000 to 300,000 milliseconds.';
$string['urloriginerror'] = 'Enter an HTTP(S) URL on this Moodle site origin.';
$string['wcag'] = 'WCAG';
