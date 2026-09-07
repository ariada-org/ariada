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

namespace local_ariada;

use local_ariada\local\url_policy;
use PHPUnit\Framework\TestCase;

/**
 * Scan target boundary tests.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class url_policy_test extends TestCase {
    /**
     * Same-origin pages are accepted.
     */
    public function test_accepts_same_origin_course_url(): void {
        $policy = new url_policy('https://learn.example/moodle');
        self::assertSame(
            'https://learn.example/course/view.php?id=7',
            $policy->validate('https://learn.example/course/view.php?id=7')
        );
    }

    /**
     * Cross-origin pages are rejected.
     */
    public function test_rejects_cross_origin_url(): void {
        $this->expectException(\InvalidArgumentException::class);
        (new url_policy('https://learn.example'))->validate('https://metadata.invalid/latest');
    }

    /**
     * Embedded credentials are rejected.
     */
    public function test_rejects_embedded_credentials(): void {
        $this->expectException(\InvalidArgumentException::class);
        (new url_policy('https://learn.example'))->validate('https://user:secret@learn.example/course/');
    }
}
