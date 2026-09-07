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
 * Navigation callbacks.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
/**
 * Add the report link to course navigation.
 *
 * @param navigation_node $navigation Course navigation.
 * @param stdClass $course Course record.
 */
function local_ariada_extend_navigation_course(navigation_node $navigation, stdClass $course): void {
    if ((int) $course->id === SITEID) {
        return;
    }
    $context = context_course::instance($course->id);
    if (has_capability('local/ariada:view', $context)) {
        $navigation->add(
            get_string('pluginname', 'local_ariada'),
            new moodle_url('/local/ariada/report.php', ['courseid' => $course->id]),
            navigation_node::TYPE_SETTING,
            null,
            'local_ariada_report',
            new pix_icon('i/report', '')
        );
    }
}
