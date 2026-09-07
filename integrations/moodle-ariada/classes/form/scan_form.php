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

namespace local_ariada\form;

use local_ariada\local\url_policy;

/**
 * Form for queueing a same-origin course scan.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class scan_form extends \moodleform {
    /**
     * Build the form.
     */
    public function definition(): void {
        $mform = $this->_form;
        $customdata = $this->_customdata;
        $mform->addElement('hidden', 'courseid', (int) $customdata['courseid']);
        $mform->setType('courseid', PARAM_INT);
        $mform->addElement('text', 'pageurl', get_string('pageurl', 'local_ariada'), ['size' => 80]);
        $mform->setType('pageurl', PARAM_URL);
        $mform->addHelpButton('pageurl', 'pageurl', 'local_ariada');
        $mform->addRule('pageurl', null, 'required', null, 'client');
        $mform->setDefault('pageurl', $customdata['pageurl']);
        $mform->addElement('select', 'severity', get_string('severity', 'local_ariada'), [
            'minor' => get_string('severityminor', 'local_ariada'),
            'moderate' => get_string('severitymoderate', 'local_ariada'),
            'serious' => get_string('severityserious', 'local_ariada'),
            'critical' => get_string('severitycritical', 'local_ariada'),
        ]);
        $mform->setDefault('severity', $customdata['severity']);
        $this->add_action_buttons(false, get_string('scanpage', 'local_ariada'));
    }

    /**
     * Validate the URL.
     *
     * @param array $data Submitted data.
     * @param array $files Submitted files.
     * @return array Validation errors.
     */
    public function validation($data, $files): array {
        global $CFG;
        $errors = parent::validation($data, $files);
        try {
            (new url_policy($CFG->wwwroot))->validate((string) ($data['pageurl'] ?? ''));
        } catch (\InvalidArgumentException $exception) {
            $errors['pageurl'] = get_string('urloriginerror', 'local_ariada');
        }
        return $errors;
    }
}
