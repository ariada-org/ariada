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

use local_ariada\local\report_parser;
use PHPUnit\Framework\TestCase;

/**
 * Canonical report parser tests.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class report_parser_test extends TestCase {
    /**
     * Maps the real CLI contract to Moodle rows.
     */
    public function test_parses_cli_grid_and_regulatory_mappings(): void {
        $json = file_get_contents(__DIR__ . '/fixtures/ariada-multi-domain-report.json');
        $report = (new report_parser())->parse($json);
        self::assertSame(2, $report->total());
        self::assertSame(1, $report->counts['critical']);
        self::assertSame('image-alt', $report->findings[0]['ruleid']);
        self::assertSame('1.1.1', $report->findings[0]['wcag']);
        self::assertSame('9.1.1.1', $report->findings[0]['en301549']);
    }

    /**
     * Invalid payloads fail closed.
     */
    public function test_rejects_non_report_json(): void {
        $this->expectException(\InvalidArgumentException::class);
        (new report_parser())->parse('{"findings":[]}');
    }
}
