---
code: false
type: page
title: Grafana dashboards
description: Grafana dashboards
order: 500
---

# Grafana Dashboards

## Browser logs in Loki

[Browser logs](/modules/logger/1/guides/browser-logging) are written by the [ingestion controller](/modules/logger/1/guides/browser-logs-ingestion) with the backend logger: with the Loki preset, they are in the same streams as the backend logs (same `service_name`), with a `source` field set to `browser`.

The Loki preset sends each entry as a JSON line. Use the `json` parser to filter on its fields; nested fields are flattened with `_` (`err.message` becomes `err_message`). The examples use `my-app` as the `service_name`.

All browser logs:

```
{service_name="my-app"} | json | source="browser"
```

Browser namespaces follow the namespace of the backend logger: with the Kuzzle `app.log`, a `dashboard:map` entry is logged under `kuzzle:app:browser:dashboard:map`. The examples below match any prefix.

If `namespace` is a stream label (`propsToLabels: ['namespace']`), filter on it in the stream selector, which is faster:

```
{service_name="my-app", namespace=~"(.+:)?browser(:.+)?"}
```

Errors of a frontend application or namespace:

```
{service_name="my-app", level=~"error|fatal"} | json | source="browser" | app_name="dashboard"
{service_name="my-app", level=~"error|fatal"} | json | source="browser" | namespace=~"(.+:)?browser:dashboard:map(:.+)?"
```

When `namespace` is a stream label, `json` extracts the field as `namespace_extracted`: filter on the label in the stream selector instead.

The most frequent errors over the dashboard time range, grouped by [fingerprint](/modules/logger/1/guides/browser-logs-ingestion#fingerprint) (use an instant query and a table panel):

```
topk(20, sum by (fingerprint, err_name) (
  count_over_time({service_name="my-app", level=~"error|fatal"} | json | source="browser" [$__range])
))
```

The number of users affected by each error:

```
count by (fingerprint) (
  sum by (fingerprint, userId) (
    count_over_time({service_name="my-app", level=~"error|fatal"} | json | source="browser" [$__range])
  )
)
```

The occurrences of one error, to read its message, stack and context:

```
{service_name="my-app"} | json | fingerprint="0a3f9c2e81b4d7"
```

::: info
`fingerprint`, `userId` and `err_message` have many values: keep them as parsed fields, never as Loki labels (`propsToLabels`).
:::

## Loki dashboard

The dashboard below has a panel for all logs, and three panels for browser logs: errors over time, the top errors by fingerprint (with the number of affected users), and the browser logs. Import it in Grafana (**Dashboards** > **New** > **Import**) and select your Loki data source.

```json
{
  "__inputs": [
    {
      "name": "DS_LOKI",
      "label": "loki",
      "description": "",
      "type": "datasource",
      "pluginId": "loki",
      "pluginName": "Loki"
    }
  ],
  "__elements": {},
  "__requires": [
    {
      "type": "grafana",
      "id": "grafana",
      "name": "Grafana",
      "version": "11.5.1"
    },
    {
      "type": "panel",
      "id": "logs",
      "name": "Logs",
      "version": ""
    },
    {
      "type": "datasource",
      "id": "loki",
      "name": "Loki",
      "version": "1.0.0"
    },
    {
      "type": "panel",
      "id": "table",
      "name": "Table",
      "version": ""
    },
    {
      "type": "panel",
      "id": "timeseries",
      "name": "Time series",
      "version": ""
    }
  ],
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": {
          "type": "grafana",
          "uid": "-- Grafana --"
        },
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": null,
  "links": [],
  "panels": [
    {
      "datasource": {
        "type": "loki",
        "uid": "${DS_LOKI}"
      },
      "gridPos": {
        "h": 13,
        "w": 24,
        "x": 0,
        "y": 0
      },
      "id": 1,
      "options": {
        "dedupStrategy": "none",
        "enableInfiniteScrolling": false,
        "enableLogDetails": true,
        "prettifyLogMessage": false,
        "showCommonLabels": false,
        "showLabels": false,
        "showTime": true,
        "sortOrder": "Descending",
        "wrapLogMessage": false
      },
      "pluginVersion": "11.5.1",
      "targets": [
        {
          "datasource": {
            "type": "loki",
            "uid": "${DS_LOKI}"
          },
          "direction": "backward",
          "editorMode": "builder",
          "expr": "{service_name=~\"$service_name\", level=~\"$log_level\"} |= `` | json | line_format `[{{.app}}] {{.msg}}`",
          "queryType": "range",
          "refId": "A"
        }
      ],
      "title": "Logs",
      "type": "logs"
    },
    {
      "datasource": {
        "type": "loki",
        "uid": "${DS_LOKI}"
      },
      "gridPos": {
        "h": 8,
        "w": 24,
        "x": 0,
        "y": 13
      },
      "id": 2,
      "title": "Browser errors",
      "type": "timeseries",
      "fieldConfig": {
        "defaults": {
          "custom": {
            "drawStyle": "bars",
            "fillOpacity": 80
          }
        },
        "overrides": []
      },
      "options": {
        "legend": {
          "displayMode": "list",
          "placement": "bottom",
          "showLegend": true
        },
        "tooltip": {
          "mode": "multi",
          "sort": "desc"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "loki",
            "uid": "${DS_LOKI}"
          },
          "editorMode": "code",
          "expr": "sum by (level) (count_over_time({service_name=~\"$service_name\", level=~\"error|fatal\"} | json | source=`browser` [$__auto]))",
          "legendFormat": "{{level}}",
          "queryType": "range",
          "refId": "A"
        }
      ]
    },
    {
      "datasource": {
        "type": "loki",
        "uid": "${DS_LOKI}"
      },
      "gridPos": {
        "h": 10,
        "w": 24,
        "x": 0,
        "y": 21
      },
      "id": 3,
      "title": "Top browser errors",
      "type": "table",
      "options": {
        "showHeader": true,
        "sortBy": [
          {
            "desc": true,
            "displayName": "Occurrences"
          }
        ]
      },
      "targets": [
        {
          "datasource": {
            "type": "loki",
            "uid": "${DS_LOKI}"
          },
          "editorMode": "code",
          "expr": "topk(20, sum by (fingerprint, err_name) (count_over_time({service_name=~\"$service_name\", level=~\"error|fatal\"} | json | source=`browser` [$__range])))",
          "format": "table",
          "instant": true,
          "queryType": "instant",
          "refId": "A"
        },
        {
          "datasource": {
            "type": "loki",
            "uid": "${DS_LOKI}"
          },
          "editorMode": "code",
          "expr": "count by (fingerprint) (sum by (fingerprint, userId) (count_over_time({service_name=~\"$service_name\", level=~\"error|fatal\"} | json | source=`browser` [$__range])))",
          "format": "table",
          "instant": true,
          "queryType": "instant",
          "refId": "B"
        }
      ],
      "transformations": [
        {
          "id": "merge",
          "options": {}
        },
        {
          "id": "organize",
          "options": {
            "excludeByName": {
              "Time": true
            },
            "renameByName": {
              "Value #A": "Occurrences",
              "Value #B": "Users",
              "err_name": "Error",

              "fingerprint": "Fingerprint"
            }
          }
        }
      ]
    },
    {
      "datasource": {
        "type": "loki",
        "uid": "${DS_LOKI}"
      },
      "gridPos": {
        "h": 13,
        "w": 24,
        "x": 0,
        "y": 31
      },
      "id": 4,
      "title": "Browser logs",
      "type": "logs",
      "options": {
        "dedupStrategy": "none",
        "enableInfiniteScrolling": false,
        "enableLogDetails": true,
        "prettifyLogMessage": false,
        "showCommonLabels": false,
        "showLabels": false,
        "showTime": true,
        "sortOrder": "Descending",
        "wrapLogMessage": false
      },
      "pluginVersion": "11.5.1",
      "targets": [
        {
          "datasource": {
            "type": "loki",
            "uid": "${DS_LOKI}"
          },
          "direction": "backward",
          "editorMode": "code",
          "expr": "{service_name=~\"$service_name\", level=~\"$log_level\"} | json | source=`browser` | line_format `[{{ or .namespace_extracted .namespace }}] {{.msg}}`",
          "queryType": "range",
          "refId": "A"
        }
      ]
    }
  ],
  "refresh": "",
  "schemaVersion": 40,
  "tags": [],
  "templating": {
    "list": [
      {
        "allValue": "",
        "current": {},
        "definition": "",
        "description": "",
        "includeAll": true,
        "label": "Service Name",
        "multi": true,
        "name": "service_name",
        "options": [],
        "query": {
          "label": "service_name",
          "refId": "LokiVariableQueryEditor-VariableQuery",
          "stream": "",
          "type": 1
        },
        "refresh": 1,
        "regex": "",
        "type": "query"
      },
      {
        "current": {},
        "definition": "",
        "includeAll": true,
        "label": "Log level",
        "multi": true,
        "name": "log_level",
        "options": [],
        "query": {
          "label": "level",
          "refId": "LokiVariableQueryEditor-VariableQuery",
          "stream": "",
          "type": 1
        },
        "refresh": 1,
        "regex": "",
        "type": "query"
      }
    ]
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "browser",
  "title": "Kuzzle logs",
  "uid": "fec1gakjxwrggd",
  "version": 3,
  "weekStart": ""
}
```
