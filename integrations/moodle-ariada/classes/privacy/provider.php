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

namespace local_ariada\privacy;

use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\transform;
use core_privacy\local\request\writer;

/**
 * Privacy provider for requesting-user scan records.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class provider implements
    \core_privacy\local\metadata\provider,
    \core_privacy\local\request\plugin\provider {
    /**
     * Describe the personal data stored by this plugin.
     *
     * @param collection $collection Metadata collection.
     * @return collection Updated collection.
     */
    public static function get_metadata(collection $collection): collection {
        return $collection->add_database_table('local_ariada_scan', [
            'courseid' => 'privacy:metadata:scan:courseid',
            'userid' => 'privacy:metadata:scan:userid',
            'pageurl' => 'privacy:metadata:scan:pageurl',
            'reportjson' => 'privacy:metadata:scan:reportjson',
            'timecreated' => 'privacy:metadata:scan:timecreated',
        ], 'privacy:metadata:scan');
    }

    /**
     * Locate course contexts containing data for a user.
     *
     * @param int $userid User ID.
     * @return contextlist Contexts containing user data.
     */
    public static function get_contexts_for_userid(int $userid): contextlist {
        $contextlist = new contextlist();
        $sql = 'SELECT ctx.id
                  FROM {context} ctx
                  JOIN {local_ariada_scan} scan ON scan.courseid = ctx.instanceid
                 WHERE ctx.contextlevel = :contextlevel AND scan.userid = :userid';
        $contextlist->add_from_sql($sql, ['contextlevel' => CONTEXT_COURSE, 'userid' => $userid]);
        return $contextlist;
    }

    /**
     * Export approved scan records for a user.
     *
     * @param approved_contextlist $contextlist Approved contexts.
     */
    public static function export_user_data(approved_contextlist $contextlist): void {
        global $DB;
        foreach ($contextlist->get_contexts() as $context) {
            if ($context->contextlevel !== CONTEXT_COURSE) {
                continue;
            }
            $records = $DB->get_records('local_ariada_scan', [
                'courseid' => $context->instanceid,
                'userid' => $contextlist->get_user()->id,
            ], 'timecreated ASC');
            $export = [];
            foreach ($records as $record) {
                $export[] = (object) [
                    'pageurl' => $record->pageurl,
                    'status' => $record->status,
                    'findingcount' => $record->findingcount,
                    'timecreated' => transform::datetime($record->timecreated),
                ];
            }
            writer::with_context($context)->export_data(
                [get_string('privacy:path', 'local_ariada')],
                (object) ['scans' => $export]
            );
        }
    }

    /**
     * Delete all scan records in a course context.
     *
     * @param \context $context Context to erase.
     */
    public static function delete_data_for_all_users_in_context(\context $context): void {
        global $DB;
        if ($context->contextlevel === CONTEXT_COURSE) {
            $DB->delete_records('local_ariada_scan', ['courseid' => $context->instanceid]);
        }
    }

    /**
     * Delete one user's scan records in approved contexts.
     *
     * @param approved_contextlist $contextlist Approved contexts.
     */
    public static function delete_data_for_user(approved_contextlist $contextlist): void {
        global $DB;
        foreach ($contextlist->get_contexts() as $context) {
            if ($context->contextlevel === CONTEXT_COURSE) {
                $DB->delete_records('local_ariada_scan', [
                    'courseid' => $context->instanceid,
                    'userid' => $contextlist->get_user()->id,
                ]);
            }
        }
    }
}
