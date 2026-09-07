<?php
/**
 * Ariada CLI process adapter.
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
 * Runs a same-host Ariada CLI installation without invoking a shell.
 */
final class CliRunner {

	private const MAX_REPORT_BYTES = 20971520;
	private const MAX_OUTPUT_BYTES = 8192;

	/**
	 * CLI binary or absolute executable path.
	 *
	 * @var string
	 */
	private string $binary;

	/**
	 * Temporary directory root.
	 *
	 * @var string
	 */
	private string $temp_root;

	/**
	 * Configure the local process adapter.
	 *
	 * @param string $binary    CLI binary.
	 * @param string $temp_root Optional temporary root.
	 */
	public function __construct( string $binary = 'ariada', string $temp_root = '' ) {
		$this->binary    = '' !== trim( $binary ) ? trim( $binary ) : 'ariada';
		$this->temp_root = '' !== $temp_root ? $temp_root : sys_get_temp_dir();
	}

	/**
	 * Run one URL scan.
	 *
	 * Exit 0 and 1 are both valid report-producing outcomes.
	 *
	 * @param string $url        Rendered page URL.
	 * @param string $threshold  Severity threshold.
	 * @param int    $timeout_ms Navigation timeout.
	 * @return array<string,mixed>
	 */
	public function run( string $url, string $threshold = 'serious', int $timeout_ms = 30000 ): array {
		if ( ! function_exists( 'proc_open' ) ) {
			return array(
				'ok'    => false,
				'error' => 'proc_open is unavailable on this server.',
			);
		}
		if ( false === filter_var( $url, FILTER_VALIDATE_URL ) || ! in_array( (string) parse_url( $url, PHP_URL_SCHEME ), array( 'http', 'https' ), true ) ) {
			return array(
				'ok'    => false,
				'error' => 'The scan target is not a valid HTTP(S) URL.',
			);
		}
		if ( ! in_array( $threshold, array( 'minor', 'moderate', 'serious', 'critical' ), true ) ) {
			return array(
				'ok'    => false,
				'error' => 'The severity threshold is invalid.',
			);
		}

		$timeout_ms = max( 5000, min( 120000, $timeout_ms ) );
		$output_dir = $this->create_temp_dir();
		if ( null === $output_dir ) {
			return array(
				'ok'    => false,
				'error' => 'Unable to allocate a private scan directory.',
			);
		}

		try {
			$command = array(
				$this->binary,
				'scan',
				$url,
				'--format',
				'json',
				'--output-dir',
				$output_dir,
				'--severity-threshold',
				$threshold,
				'--timeout-ms',
				(string) $timeout_ms,
			);
			$process = $this->execute( $command, $timeout_ms + 15000 );
			if ( $process['timed_out'] ) {
				return array(
					'ok'        => false,
					'error'     => 'The Ariada CLI process exceeded its wall-clock timeout.',
					'exit_code' => 3,
				);
			}

			$exit_code = (int) $process['exit_code'];
			if ( ! in_array( $exit_code, array( 0, 1 ), true ) ) {
				$errors = array(
					2 => 'The Ariada CLI rejected its arguments.',
					3 => 'The Ariada CLI could not scan the page.',
					4 => 'The installed Ariada CLI does not implement this command.',
					5 => 'The Ariada CLI pre-check failed.',
				);
				$error  = $errors[ $exit_code ] ?? sprintf( 'The Ariada CLI exited with code %d.', $exit_code );
				if ( '' !== $process['stderr'] ) {
					$error .= ' ' . $this->plain_error( $process['stderr'] );
				}
				return array(
					'ok'        => false,
					'error'     => $error,
					'exit_code' => $exit_code,
				);
			}

			$report_file = is_readable( $output_dir . '/scan.json' )
				? $output_dir . '/scan.json'
				: $output_dir . '/report.json';
			if ( ! is_readable( $report_file ) ) {
				return array(
					'ok'        => false,
					'error'     => 'The Ariada CLI completed without a readable JSON report.',
					'exit_code' => $exit_code,
				);
			}
			$size = filesize( $report_file );
			if ( false === $size || $size > self::MAX_REPORT_BYTES ) {
				return array(
					'ok'        => false,
					'error'     => 'The Ariada report exceeds the 20 MB safety limit.',
					'exit_code' => $exit_code,
				);
			}

			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Private CLI output in a temporary directory.
			$json = file_get_contents( $report_file );
			if ( false === $json || '' === trim( $json ) ) {
				return array(
					'ok'        => false,
					'error'     => 'The Ariada CLI produced an empty report.',
					'exit_code' => $exit_code,
				);
			}

			try {
				$report = Report::from_json( $json );
			} catch ( \InvalidArgumentException $error ) {
				return array(
					'ok'        => false,
					'error'     => $error->getMessage(),
					'exit_code' => $exit_code,
				);
			}

			return array(
				'ok'        => true,
				'exit_code' => $exit_code,
				'report'    => $report,
			);
		} finally {
			$this->remove_dir( $output_dir );
		}
	}

	/**
	 * Create a mode-0700 temporary directory.
	 *
	 * @return string|null
	 */
	private function create_temp_dir(): ?string {
		$path = tempnam( $this->temp_root, 'ariada-ld-' );
		if ( false === $path ) {
			return null;
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- Removing the file reserved by tempnam.
		unlink( $path );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_mkdir -- Private runtime temp directory.
		if ( ! mkdir( $path, 0700, true ) && ! is_dir( $path ) ) {
			return null;
		}
		return $path;
	}

	/**
	 * Execute a command array without a shell.
	 *
	 * @param array<int,string> $command         Command and arguments.
	 * @param int               $wall_timeout_ms Process wall timeout.
	 * @return array{exit_code:int,stdout:string,stderr:string,timed_out:bool}
	 */
	private function execute( array $command, int $wall_timeout_ms ): array {
		$descriptors = array(
			0 => array( 'pipe', 'r' ),
			1 => array( 'pipe', 'w' ),
			2 => array( 'pipe', 'w' ),
		);

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.system_calls_proc_open -- Explicit local CLI adapter; array form bypasses the shell.
		$process = proc_open( $command, $descriptors, $pipes );
		if ( ! is_resource( $process ) ) {
			return array(
				'exit_code' => -1,
				'stdout'    => '',
				'stderr'    => '',
				'timed_out' => false,
			);
		}

		fclose( $pipes[0] );
		stream_set_blocking( $pipes[1], false );
		stream_set_blocking( $pipes[2], false );
		$stdout    = '';
		$stderr    = '';
		$timed_out = false;
		$exit_code = -1;
		$deadline  = microtime( true ) + ( $wall_timeout_ms / 1000 );

		do {
			$this->append_output( $stdout, stream_get_contents( $pipes[1] ) );
			$this->append_output( $stderr, stream_get_contents( $pipes[2] ) );
			$status = proc_get_status( $process );
			if ( isset( $status['exitcode'] ) && -1 !== (int) $status['exitcode'] ) {
				$exit_code = (int) $status['exitcode'];
			}
			if ( empty( $status['running'] ) ) {
				break;
			}
			if ( microtime( true ) >= $deadline ) {
				$timed_out = true;
				proc_terminate( $process );
				break;
			}
			usleep( 20000 );
		} while ( true );

		$this->append_output( $stdout, stream_get_contents( $pipes[1] ) );
		$this->append_output( $stderr, stream_get_contents( $pipes[2] ) );
		fclose( $pipes[1] );
		fclose( $pipes[2] );
		$closed_code = proc_close( $process );
		if ( -1 === $exit_code ) {
			$exit_code = $closed_code;
		}

		return array(
			'exit_code' => $exit_code,
			'stdout'    => $stdout,
			'stderr'    => $stderr,
			'timed_out' => $timed_out,
		);
	}

	/**
	 * Append bounded subprocess output.
	 *
	 * @param string       $target Accumulator.
	 * @param string|false $chunk  New output.
	 */
	private function append_output( string &$target, string|false $chunk ): void {
		if ( false === $chunk || '' === $chunk || strlen( $target ) >= self::MAX_OUTPUT_BYTES ) {
			return;
		}
		$target .= substr( $chunk, 0, self::MAX_OUTPUT_BYTES - strlen( $target ) );
	}

	/**
	 * Convert stderr to bounded plain text.
	 *
	 * @param string $error Raw stderr.
	 * @return string
	 */
	private function plain_error( string $error ): string {
		$error = preg_replace( '/[\x00-\x1F\x7F]+/', ' ', strip_tags( $error ) ) ?? '';
		return substr( trim( $error ), 0, 1000 );
	}

	/**
	 * Recursively remove one private temp directory.
	 *
	 * @param string $dir Directory.
	 */
	private function remove_dir( string $dir ): void {
		if ( ! is_dir( $dir ) ) {
			return;
		}
		$iterator = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $dir, \RecursiveDirectoryIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ( $iterator as $item ) {
			$path = $item->getPathname();
			if ( $item->isDir() && ! $item->isLink() ) {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- Private runtime temp directory.
				rmdir( $path );
			} else {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- Private runtime temp directory.
				unlink( $path );
			}
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir -- Private runtime temp directory.
		rmdir( $dir );
	}
}
