#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

project="ariada-woo-smoke-${RANDOM}"
compose=(docker compose -p "$project" -f docker-compose.smoke.yml)
woocommerce_version="${WOOCOMMERCE_VERSION:-10.3.6}"

cleanup() {
  "${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf tests/.smoke-bin
}
trap cleanup EXIT

mkdir -p tests/.smoke-bin
cat > tests/.smoke-bin/ariada <<'SH'
#!/usr/bin/env sh
set -eu

out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-dir" ]; then
    shift
    out="$1"
  fi
  shift || true
done

mkdir -p "$out"
cat > "$out/report.json" <<'JSON'
{"grid":{"accessibility":{"ariada/mock":[{"severity":"serious","message":"mock WooCommerce product finding"}]}}}
JSON
exit 1
SH
chmod +x tests/.smoke-bin/ariada

"${compose[@]}" up -d db wordpress
"${compose[@]}" exec -T -u 0 wordpress sh -lc 'mkdir -p /var/www/html/wp-content/upgrade /var/www/html/wp-content/plugins && chown www-data:www-data /var/www/html/wp-content /var/www/html/wp-content/upgrade /var/www/html/wp-content/plugins'

wp_cli() {
  "${compose[@]}" run --rm cli wp --path=/var/www/html "$@"
}

for _ in $(seq 1 60); do
  if wp_cli core version >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

wp_cli core install \
  --url=http://localhost:8099 \
  --title="Ariada WooCommerce Smoke" \
  --admin_user=admin \
  --admin_password=password \
  --admin_email=admin@example.com \
  --skip-email

wp_cli plugin install woocommerce --version="$woocommerce_version" --activate
wp_cli plugin activate woocommerce-ariada

product_id="$(wp_cli post create --post_type=product --post_status=publish --post_title='Smoke Product' --porcelain)"
wp_cli post meta update "$product_id" _regular_price 10
wp_cli post meta update "$product_id" _price 10
wp_cli eval "update_option('ariada_woo_config', array('mode' => 'local', 'binary' => '/ariada-smoke-bin/ariada', 'threshold' => 'serious'));"

result="$(wp_cli ariada-woocommerce scan --target=product --format=json)"
printf '%s\n' "$result"
printf '%s\n' "$result" | grep -Eq 'ariada(/|\\/)mock'

echo "SMOKE_PASS"
