-- App versions in use, one vote per instance (its newest ping). Bounded to the
-- current population -- an instance whose newest ping is more than 30 days old
-- does not count, matching the public page and /data.json.
SELECT app_version,
       COUNT(*) AS instances,
       SUM(CASE WHEN app_is_dev = 1 THEN 1 ELSE 0 END) AS dev_builds,
       MAX(received_at) AS last_seen
FROM latest_pings
WHERE datetime(received_at) >= datetime('now', '-30 days')
GROUP BY app_version
ORDER BY instances DESC, app_version DESC;
