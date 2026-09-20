-- App versions in use, one vote per instance (its newest ping).
SELECT app_version,
       COUNT(*) AS instances,
       SUM(CASE WHEN app_is_dev = 1 THEN 1 ELSE 0 END) AS dev_builds,
       MAX(received_at) AS last_seen
FROM latest_pings
GROUP BY app_version
ORDER BY instances DESC, app_version DESC;
