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
 * Site settings.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage('local_ariada_settings', get_string('settings', 'local_ariada'));
    if ($ADMIN->fulltree) {
        $settings->add(new admin_setting_configtext(
            'local_ariada/nodebinary',
            get_string('nodebinary', 'local_ariada'),
            get_string('nodebinary_desc', 'local_ariada'),
            'node',
            PARAM_RAW_TRIMMED
        ));
        $settings->add(new admin_setting_configtext(
            'local_ariada/browserspath',
            get_string('browserpath', 'local_ariada'),
            get_string('browserpath_desc', 'local_ariada'),
            '',
            PARAM_RAW_TRIMMED
        ));
        $settings->add(new admin_setting_configselect(
            'local_ariada/severitythreshold',
            get_string('severitythreshold', 'local_ariada'),
            get_string('severitythreshold_desc', 'local_ariada'),
            'moderate',
            [
                'minor' => get_string('severityminor', 'local_ariada'),
                'moderate' => get_string('severitymoderate', 'local_ariada'),
                'serious' => get_string('severityserious', 'local_ariada'),
                'critical' => get_string('severitycritical', 'local_ariada'),
            ]
        ));
        $settings->add(new admin_setting_configtext(
            'local_ariada/timeoutms',
            get_string('timeoutms', 'local_ariada'),
            get_string('timeoutms_desc', 'local_ariada'),
            30000,
            PARAM_INT
        ));
        $settings->add(new admin_setting_configcheckbox(
            'local_ariada/allowprivate',
            get_string('allowprivate', 'local_ariada'),
            get_string('allowprivate_desc', 'local_ariada'),
            0
        ));
    }
    $ADMIN->add('localplugins', $settings);
    $ADMIN->add('localplugins', new admin_externalpage(
        'local_ariada_report',
        get_string('pluginname', 'local_ariada'),
        new moodle_url('/local/ariada/report.php'),
        'local/ariada:viewall'
    ));
}
