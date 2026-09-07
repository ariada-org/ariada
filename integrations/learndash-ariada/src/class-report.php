<?php
/**
 * Normalized Ariada CLI report model.
 *
 * @package AriadaLearnDash
 */

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

namespace Ariada\LearnDash;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Parses current CLI envelopes and legacy direct report shapes.
 */
final class Report {

	private const MAX_FINDINGS = 5000;

	/**
	 * Normalized report data.
	 *
	 * @var array<string,mixed>
	 */
	private array $data;

	/**
	 * Construct a normalized report.
	 *
	 * @param array<string,mixed> $data Normalized report data.
	 */
	private function __construct( array $data ) {
		$this->data = $data;
	}

	/**
	 * Parse a JSON report.
	 *
	 * @throws \InvalidArgumentException When JSON is invalid or not an object.
	 *
	 * @param string $json Ariada CLI JSON.
	 * @return self
	 */
	public static function from_json( string $json ): self {
		try {
			$payload = json_decode( $json, true, 512, JSON_THROW_ON_ERROR );
		} catch ( \JsonException $error ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- The exception is data flow, not rendered output.
			throw new \InvalidArgumentException( 'The Ariada report is not valid JSON.', 0, $error );
		}

		if ( ! is_array( $payload ) ) {
			throw new \InvalidArgumentException( 'The Ariada report must be a JSON object.' );
		}

		return self::from_array( $payload );
	}

	/**
	 * Parse a decoded report.
	 *
	 * @param array<string,mixed> $payload Decoded Ariada output.
	 * @return self
	 */
	public static function from_array( array $payload ): self {
		$report = isset( $payload['report'] ) && is_array( $payload['report'] )
			? $payload['report']
			: $payload;

		$findings = array();
		$seen     = 0;
		self::extract_findings( $report, $payload, $findings, $seen );

		$counts = array(
			'critical' => 0,
			'serious'  => 0,
			'moderate' => 0,
			'minor'    => 0,
			'unknown'  => 0,
		);
		foreach ( $findings as $finding ) {
			$impact            = (string) $finding['impact'];
			$counts[ $impact ] = ( $counts[ $impact ] ?? 0 ) + 1;
		}

		$summary         = isset( $payload['summary'] ) && is_array( $payload['summary'] )
			? $payload['summary']
			: array();
		$declared_counts = $summary['byImpact'] ?? $summary['by_impact'] ?? array();
		if ( is_array( $declared_counts ) ) {
			foreach ( $counts as $impact => $count ) {
				$declared          = isset( $declared_counts[ $impact ] ) ? (int) $declared_counts[ $impact ] : 0;
				$counts[ $impact ] = max( $count, $declared );
			}
		}

		$declared_total = isset( $summary['total'] ) ? max( 0, (int) $summary['total'] ) : 0;
		$total          = max( $seen, $declared_total );
		$url            = self::bounded_string( $payload['url'] ?? $report['url'] ?? '', 2048 );
		$scan_id        = self::bounded_string( $payload['scanId'] ?? $report['scanId'] ?? '', 200 );

		return new self(
			array(
				'schema_version' => 1,
				'scan_id'        => $scan_id,
				'url'            => $url,
				'started_at'     => self::bounded_string( $payload['startedAt'] ?? '', 100 ),
				'completed_at'   => self::bounded_string( $payload['completedAt'] ?? '', 100 ),
				'duration_ms'    => max( 0, (int) ( $payload['durationMs'] ?? 0 ) ),
				'exit_code'      => isset( $payload['exitCode'] ) ? (int) $payload['exitCode'] : null,
				'summary'        => array(
					'total'        => $total,
					'displayed'    => count( $findings ),
					'by_impact'    => $counts,
					'is_truncated' => $total > count( $findings ),
				),
				'findings'       => $findings,
			)
		);
	}

	/**
	 * Return normalized data suitable for post meta.
	 *
	 * @return array<string,mixed>
	 */
	public function to_array(): array {
		return $this->data;
	}

	/**
	 * Return the normalized finding count.
	 *
	 * @return int
	 */
	public function total(): int {
		return (int) $this->data['summary']['total'];
	}

	/**
	 * Extract supported finding shapes.
	 *
	 * @param array<string,mixed>             $report   Nested report object.
	 * @param array<string,mixed>             $payload  Top-level CLI envelope.
	 * @param array<int,array<string,string>> $findings Output findings.
	 * @param int                             $seen     Number of findings encountered.
	 */
	private static function extract_findings( array $report, array $payload, array &$findings, int &$seen ): void {
		if ( isset( $report['findings'] ) && is_array( $report['findings'] ) ) {
			if ( array_is_list( $report['findings'] ) ) {
				self::collect_findings( $report['findings'], '', $findings, $seen );
			} else {
				foreach ( $report['findings'] as $domain => $domain_findings ) {
					if ( is_array( $domain_findings ) ) {
						self::collect_findings( $domain_findings, (string) $domain, $findings, $seen );
					}
				}
			}
			return;
		}

		if ( isset( $report['grid'] ) && is_array( $report['grid'] ) ) {
			foreach ( $report['grid'] as $domain => $domain_findings ) {
				if ( is_array( $domain_findings ) ) {
					self::collect_findings( $domain_findings, (string) $domain, $findings, $seen );
				}
			}
			return;
		}

		$violations = $report['violations'] ?? $payload['violations'] ?? array();
		if ( is_array( $violations ) ) {
			self::collect_findings( $violations, 'accessibility', $findings, $seen );
		}
	}

	/**
	 * Recursively collect finding objects.
	 *
	 * @param array<mixed>                    $node       Report node.
	 * @param string                          $domain     Finding domain.
	 * @param array<int,array<string,string>> $findings Output findings.
	 * @param int                             $seen       Number encountered.
	 */
	private static function collect_findings( array $node, string $domain, array &$findings, int &$seen ): void {
		if ( self::looks_like_finding( $node ) ) {
			++$seen;
			if ( count( $findings ) < self::MAX_FINDINGS ) {
				$findings[] = self::normalize_finding( $node, $domain );
			}
			return;
		}

		foreach ( $node as $child ) {
			if ( is_array( $child ) ) {
				self::collect_findings( $child, $domain, $findings, $seen );
			}
		}
	}

	/**
	 * Determine whether a node represents a finding.
	 *
	 * @param array<mixed> $node Candidate node.
	 * @return bool
	 */
	private static function looks_like_finding( array $node ): bool {
		$has_rule = isset( $node['ruleId'] ) || isset( $node['rule_id'] ) || isset( $node['id'] );
		$has_body = isset( $node['message'] ) || isset( $node['help'] ) || isset( $node['description'] )
			|| isset( $node['severity'] ) || isset( $node['impact'] );
		return $has_rule && $has_body;
	}

	/**
	 * Normalize one finding.
	 *
	 * @param array<mixed> $finding Raw finding.
	 * @param string       $domain  Finding domain.
	 * @return array<string,string>
	 */
	private static function normalize_finding( array $finding, string $domain ): array {
		$impact = strtolower( self::bounded_string( $finding['severity'] ?? $finding['impact'] ?? 'unknown', 20 ) );
		if ( ! in_array( $impact, array( 'critical', 'serious', 'moderate', 'minor' ), true ) ) {
			$impact = 'unknown';
		}

		$selector = $finding['selector'] ?? $finding['target'] ?? '';
		if ( is_array( $selector ) ) {
			$selector = implode( ', ', array_map( 'strval', $selector ) );
		}
		if ( '' === $selector && isset( $finding['nodes'][0]['target'] ) ) {
			$selector = $finding['nodes'][0]['target'];
			if ( is_array( $selector ) ) {
				$selector = implode( ', ', array_map( 'strval', $selector ) );
			}
		}

		$criterion = $finding['criterion'] ?? $finding['wcag'] ?? '';
		if ( '' === $criterion && isset( $finding['tags'] ) && is_array( $finding['tags'] ) ) {
			$criterion = implode( ', ', array_map( 'strval', $finding['tags'] ) );
		}

		return array(
			'rule_id'   => self::bounded_string( $finding['ruleId'] ?? $finding['rule_id'] ?? $finding['id'] ?? 'unknown', 250 ),
			'impact'    => $impact,
			'domain'    => self::bounded_string( $domain, 100 ),
			'criterion' => self::bounded_string( $criterion, 500 ),
			'message'   => self::bounded_string(
				$finding['message'] ?? $finding['help'] ?? $finding['description'] ?? $finding['failureSummary'] ?? '',
				2000
			),
			'selector'  => self::bounded_string( $selector, 1000 ),
		);
	}

	/**
	 * Convert a scalar to bounded plain text.
	 *
	 * @param mixed $value  Input value.
	 * @param int   $length Maximum bytes.
	 * @return string
	 */
	private static function bounded_string( mixed $value, int $length ): string {
		if ( ! is_scalar( $value ) ) {
			return '';
		}
		$text = trim( strip_tags( (string) $value ) );
		$text = preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text ) ?? '';
		return strlen( $text ) > $length ? substr( $text, 0, $length ) : $text;
	}
}
