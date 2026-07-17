# Example RapidAPI Requests

```sh
curl --request POST \
  --url https://ariada-scan.p.rapidapi.com/v1/scans \
  --header 'Content-Type: application/json' \
  --header 'X-RapidAPI-Host: ariada-scan.p.rapidapi.com' \
  --header 'X-RapidAPI-Key: ${RAPIDAPI_KEY}' \
  --data @examples/scan-url-request.json
```

```sh
curl --request POST \
  --url https://ariada-scan.p.rapidapi.com/v1/scans \
  --header 'Content-Type: application/json' \
  --header 'X-RapidAPI-Host: ariada-scan.p.rapidapi.com' \
  --header 'X-RapidAPI-Key: ${RAPIDAPI_KEY}' \
  --data @examples/scan-html-request.json
```

Update:
- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-07-01
