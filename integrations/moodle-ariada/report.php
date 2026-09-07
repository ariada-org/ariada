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
 * Course and site report page.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
use local_ariada\form\scan_form;
use local_ariada\local\cli_runner;
use local_ariada\local\report_parser;
use local_ariada\local\scan_repository;
use local_ariada\local\url_policy;
use local_ariada\task\run_scan;

require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/adminlib.php');
require_once($CFG->libdir . '/formslib.php');

$courseid = optional_param('courseid', 0, PARAM_INT);
$scanid = optional_param('id', 0, PARAM_INT);
$repository = new scan_repository();

if ($courseid > 0) {
    $course = get_course($courseid);
    require_login($course);
    $context = context_course::instance($courseid);
    require_capability('local/ariada:view', $context);
    $PAGE->set_context($context);
    $PAGE->set_course($course);
    $PAGE->set_pagelayout('report');
    $PAGE->set_url('/local/ariada/report.php', ['courseid' => $courseid]);
    $PAGE->set_title(get_string('reportfor', 'local_ariada', format_string($course->fullname)));
    $PAGE->set_heading(format_string($course->fullname));
} else {
    require_login();
    $context = context_system::instance();
    require_capability('local/ariada:viewall', $context);
    admin_externalpage_setup('local_ariada_report');
    $PAGE->set_title(get_string('pluginname', 'local_ariada'));
    $PAGE->set_heading(get_string('pluginname', 'local_ariada'));
}

$record = null;
if ($scanid > 0) {
    $record = $repository->get($scanid);
    if ($courseid > 0 && (int) $record->courseid !== $courseid) {
        throw new moodle_exception('nopermissions', 'error');
    }
    if ($courseid === 0) {
        require_capability('local/ariada:viewall', context_system::instance());
    }
}

$form = null;
if ($courseid > 0 && has_capability('local/ariada:scan', $context)) {
    $form = new scan_form(null, [
        'courseid' => $courseid,
        'pageurl' => (new moodle_url('/course/view.php', ['id' => $courseid]))->out(false),
        'severity' => (string) (get_config('local_ariada', 'severitythreshold') ?: 'moderate'),
    ]);
    if ($data = $form->get_data()) {
        require_capability('local/ariada:scan', $context);
        if ((int) $data->courseid !== $courseid) {
            throw new moodle_exception('invalidcourseid');
        }
        $pageurl = (new url_policy($CFG->wwwroot))->validate((string) $data->pageurl);
        $newscanid = $repository->create($courseid, $USER->id, $pageurl, (string) $data->severity);
        $task = new run_scan();
        $task->set_custom_data((object) ['scanid' => $newscanid]);
        $task->set_userid($USER->id);
        core\task\manager::queue_adhoc_task($task);
        redirect(
            new moodle_url('/local/ariada/report.php', ['courseid' => $courseid]),
            get_string('scanqueued', 'local_ariada')
        );
    }
}

echo $OUTPUT->header();
echo $OUTPUT->heading($PAGE->title);
echo html_writer::tag('p', get_string('intro', 'local_ariada'));
if (!is_file(cli_runner::cli_path())) {
    echo $OUTPUT->notification(get_string('runtimeblocked', 'local_ariada'), 'error');
}

if ($record !== null) {
    echo $OUTPUT->heading(get_string('details', 'local_ariada'), 3);
    if ($record->status === 'failed') {
        echo $OUTPUT->notification(get_string('clierror', 'local_ariada', s($record->errormessage)), 'error');
    } else if (is_string($record->reportjson) && $record->reportjson !== '') {
        try {
            $model = (new report_parser())->parse($record->reportjson);
            if ($model->findings === []) {
                echo $OUTPUT->notification(get_string('nofindings', 'local_ariada'), 'success');
            } else {
                $details = new html_table();
                $details->head = [
                    get_string('severity', 'local_ariada'),
                    get_string('rule', 'local_ariada'),
                    get_string('wcag', 'local_ariada'),
                    get_string('en301549', 'local_ariada'),
                    get_string('message', 'local_ariada'),
                    get_string('selector', 'local_ariada'),
                ];
                foreach ($model->findings as $finding) {
                    $details->data[] = [
                        s($finding['severity']),
                        s($finding['ruleid']),
                        s($finding['wcag'] ?: $finding['criterion']),
                        s($finding['en301549']),
                        s($finding['message']),
                        html_writer::tag('code', s($finding['selector'])),
                    ];
                }
                echo html_writer::table($details);
            }
        } catch (InvalidArgumentException $exception) {
            echo $OUTPUT->notification(get_string('cannotreadreport', 'local_ariada'), 'error');
        }
    }
}

if ($form !== null) {
    $form->display();
}
$records = $repository->recent($courseid);
if ($records === []) {
    echo $OUTPUT->notification(get_string('noreports', 'local_ariada'), 'info');
} else {
    $table = new html_table();
    $table->head = [
        get_string('timecreated', 'local_ariada'),
        get_string('course', 'local_ariada'),
        get_string('pageurl', 'local_ariada'),
        get_string('status', 'local_ariada'),
        get_string('findingcount', 'local_ariada'),
        get_string('details', 'local_ariada'),
    ];
    foreach ($records as $item) {
        $detailurl = new moodle_url('/local/ariada/report.php', [
            'courseid' => $courseid,
            'id' => $item->id,
        ]);
        $table->data[] = [
            userdate($item->timecreated),
            html_writer::link(new moodle_url('/course/view.php', ['id' => $item->courseid]), (string) $item->courseid),
            html_writer::link($item->pageurl, s($item->pageurl)),
            get_string('status' . $item->status, 'local_ariada'),
            (int) $item->findingcount,
            html_writer::link($detailurl, get_string('details', 'local_ariada')),
        ];
    }
    echo html_writer::table($table);
}
echo $OUTPUT->footer();
