<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Security;

use Bitrix\Ariada\Exception\ModuleException;

final class PublicUrlValidator
{
    /** @var callable|null */
    private $resolver;

    public function __construct(?callable $resolver = null)
    {
        $this->resolver = $resolver;
    }

    public function validate(string $url, bool $resolveDns = true): string
    {
        $url = trim($url);
        if ($url === '' || strlen($url) > 2048 || preg_match('/[\x00-\x1F\x7F]/', $url) === 1) {
            throw ModuleException::configuration('Public URL is empty or malformed.');
        }

        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            throw ModuleException::configuration('Public URL must be a valid HTTP(S) URL.');
        }

        $parts = parse_url($url);
        if (!is_array($parts)) {
            throw ModuleException::configuration('Public URL must be a valid HTTP(S) URL.');
        }

        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        $host = strtolower(trim((string)($parts['host'] ?? ''), '[]'));
        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw ModuleException::configuration('Public URL must use HTTP or HTTPS and include a host.');
        }

        if (isset($parts['user']) || isset($parts['pass']) || array_key_exists('query', $parts) || array_key_exists('fragment', $parts)) {
            throw ModuleException::configuration('Public URL cannot contain credentials, query parameters, or a fragment.');
        }

        $port = isset($parts['port']) ? (int)$parts['port'] : null;
        if ($port !== null && !in_array($port, [80, 443], true)) {
            throw ModuleException::configuration('Public URL can use only port 80 or 443.');
        }

        $path = (string)($parts['path'] ?? '/');
        if ($path === '') {
            $path = '/';
        }
        if (strpos($path, '\\') !== false || preg_match('/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i', $path) === 1) {
            throw ModuleException::configuration('Public URL path contains disallowed characters.');
        }

        if ($this->isLocalHostname($host)) {
            throw ModuleException::configuration('Public URL must not target a local or internal hostname.');
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            $this->assertPublicAddress($host);
        } else {
            if (preg_match('/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $host) !== 1) {
                throw ModuleException::configuration('Public URL host must be an ASCII DNS name or IP address.');
            }
            if ($resolveDns) {
                $addresses = $this->resolve($host);
                if ($addresses === []) {
                    throw ModuleException::configuration('Public URL host did not resolve to an address.');
                }
                foreach ($addresses as $address) {
                    $this->assertPublicAddress($address);
                }
            }
        }

        $defaultPort = ($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443);
        $portPart = $port !== null && !$defaultPort ? ':' . $port : '';
        $hostPart = strpos($host, ':') !== false ? '[' . $host . ']' : $host;

        return $scheme . '://' . $hostPart . $portPart . $path;
    }

    private function isLocalHostname(string $host): bool
    {
        return $host === 'localhost'
            || substr($host, -10) === '.localhost'
            || substr($host, -6) === '.local'
            || substr($host, -9) === '.internal';
    }

    private function assertPublicAddress(string $address): void
    {
        $valid = filter_var(
            $address,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
        if ($valid === false) {
            throw ModuleException::configuration('Public URL must resolve only to public IP addresses.');
        }
    }

    /** @return string[] */
    private function resolve(string $host): array
    {
        if ($this->resolver !== null) {
            $result = ($this->resolver)($host);
            return is_array($result) ? array_values(array_unique(array_map('strval', $result))) : [];
        }

        if (!function_exists('dns_get_record')) {
            throw ModuleException::configuration('DNS validation is unavailable on this PHP installation.');
        }

        $records = @dns_get_record($host, DNS_A | DNS_AAAA);
        if (!is_array($records)) {
            return [];
        }

        $addresses = [];
        foreach ($records as $record) {
            if (isset($record['ip']) && is_string($record['ip'])) {
                $addresses[] = $record['ip'];
            }
            if (isset($record['ipv6']) && is_string($record['ipv6'])) {
                $addresses[] = $record['ipv6'];
            }
        }

        return array_values(array_unique($addresses));
    }
}
