---
code: false
type: page
title: Grafana dashboards
description: Grafana dashboards
order: 300
---

# Grafana Dashboards

## Loki

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
      "title": "Panel Title",
      "type": "logs"
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
  "title": "Logs demo",
  "uid": "fec1gakjxwrggd",
  "version": 3,
  "weekStart": ""
}
```
