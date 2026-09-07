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

namespace local_ariada\local;

/**
 * Persistence boundary for scan records.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class scan_repository {
    /**
     * Create a queued scan record.
     *
     * @param int $courseid Course ID.
     * @param int $userid User ID.
     * @param string $pageurl Page URL.
     * @param string $severity Threshold.
     * @return int Record ID.
     */
    public function create(int $courseid, int $userid, string $pageurl, string $severity): int {
        global $DB;
        $now = time();
        return (int) $DB->insert_record('local_ariada_scan', (object) [
            'courseid' => $courseid,
            'userid' => $userid,
            'pageurl' => $pageurl,
            'severity' => $severity,
            'status' => 'queued',
            'timecreated' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Load one scan record.
     *
     * @param int $scanid Record ID.
     * @return \stdClass Record.
     */
    public function get(int $scanid): \stdClass {
        global $DB;
        return $DB->get_record('local_ariada_scan', ['id' => $scanid], '*', MUST_EXIST);
    }

    /**
     * Load recent scans for a course or the site.
     *
     * @param int $courseid Course ID or zero for all.
     * @return array Recent records.
     */
    public function recent(int $courseid): array {
        global $DB;
        $conditions = $courseid > 0 ? ['courseid' => $courseid] : [];
        return $DB->get_records('local_ariada_scan', $conditions, 'timecreated DESC', '*', 0, 100);
    }

    /**
     * Mark a queued scan as running.
     *
     * @param int $scanid Record ID.
     */
    public function mark_running(int $scanid): void {
        global $DB;
        $now = time();
        $DB->update_record('local_ariada_scan', (object) [
            'id' => $scanid, 'status' => 'running', 'timestarted' => $now, 'timemodified' => $now,
        ]);
    }

    /**
     * Persist a successfully parsed report.
     *
     * @param int $scanid Record ID.
     * @param int $exitcode Ariada exit code.
     * @param string $json Canonical JSON.
     * @param report_model $report Parsed report.
     */
    public function complete(int $scanid, int $exitcode, string $json, report_model $report): void {
        global $DB;
        $now = time();
        $DB->update_record('local_ariada_scan', (object) [
            'id' => $scanid,
            'status' => 'completed',
            'exitcode' => $exitcode,
            'findingcount' => $report->total(),
            'criticalcount' => $report->counts['critical'],
            'seriouscount' => $report->counts['serious'],
            'moderatecount' => $report->counts['moderate'],
            'minorcount' => $report->counts['minor'],
            'reportjson' => $json,
            'errormessage' => null,
            'timefinished' => $now,
            'timemodified' => $now,
        ]);
    }

    /**
     * Persist a terminal scan failure.
     *
     * @param int $scanid Record ID.
     * @param int $exitcode Exit code.
     * @param string $message Failure detail.
     */
    public function fail(int $scanid, int $exitcode, string $message): void {
        global $DB;
        $now = time();
        $DB->update_record('local_ariada_scan', (object) [
            'id' => $scanid,
            'status' => 'failed',
            'exitcode' => $exitcode,
            'errormessage' => mb_substr($message, 0, 4000),
            'timefinished' => $now,
            'timemodified' => $now,
        ]);
    }
}
