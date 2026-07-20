#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK_DIR="${TYPO3_SMOKE_DIR:-$(mktemp -d /tmp/typo3-ariada-smoke.XXXXXX)}"

printf 'TYPO3_SMOKE_DIR=%s\n' "$WORK_DIR"

docker run --rm \
  -e DEBIAN_FRONTEND=noninteractive \
  -v "$ROOT_DIR":/repo \
  -v "$WORK_DIR":/work \
  -w /work \
  php:8.3-cli bash -lc '
set -euo pipefail

printf "[1/9] apt dependencies\n"
apt-get update >/dev/null
apt-get install -y --no-install-recommends ca-certificates curl git unzip libicu-dev libzip-dev zlib1g-dev libxml2-dev >/dev/null

printf "[2/9] php extensions\n"
docker-php-ext-install intl zip pdo_mysql >/dev/null

printf "[3/9] composer install\n"
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer >/dev/null
composer --version

printf "[4/9] create TYPO3 project\n"
composer create-project typo3/cms-base-distribution:^13 . --no-interaction --no-progress

printf "[5/9] require S8 extension\n"
composer config repositories.ariada-typo3 path /repo/integrations/typo3-ariada
composer require ariada/typo3-ariada:@dev --no-interaction --no-progress

printf "[6/9] extension discovery\n"
php -r '\''$installed=json_decode(file_get_contents("vendor/composer/installed.json"), true); $packages=$installed["packages"] ?? $installed; foreach ($packages as $package) { if (($package["name"] ?? "") === "ariada/typo3-ariada") { echo "EXTENSION_DISCOVERED\n"; exit(0); } } fwrite(STDERR, "extension package not found\n"); exit(1);'\''

printf "[7/9] mock ariada binary\n"
mkdir -p var/bin
cat > var/bin/ariada <<'\''EOF'\''
#!/bin/sh
printf '\''{"findings":[{"ruleId":"mock-rule","severity":"minor","message":"mock finding"}]}\n'\''
exit 0
EOF
chmod +x var/bin/ariada

printf "[8/9] TYPO3 command registration\n"
ARIADA_CLI="$PWD/var/bin/ariada" vendor/bin/typo3 list | tee typo3-list.txt
grep -q "ariada:scan" typo3-list.txt

printf "[9/9] Ariada command boundary\n"
ARIADA_CLI="$PWD/var/bin/ariada" vendor/bin/typo3 ariada:scan https://example.org | tee ariada-scan.txt
grep -q "mock-rule" ariada-scan.txt

printf "SMOKE_PASS\n"
'
