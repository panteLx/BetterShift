-- The most recent pings, unaggregated -- the quickest check that ingest still works.
SELECT received_at, instance_id, app_version, app_is_dev,
       runtime_platform, runtime_node, scale_users, scale_shifts, health_uptime_hours
FROM instance_pings
ORDER BY id DESC
LIMIT 25;
