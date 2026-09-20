-- Uptime and external-sync health, as of each instance's newest ping.
SELECT COUNT(*) AS instances,
       ROUND(AVG(health_uptime_hours), 1) AS avg_uptime_hours,
       MAX(health_uptime_hours) AS max_uptime_hours,
       SUM(health_sync_runs_24h) AS sync_runs_24h,
       SUM(health_sync_failures_24h) AS sync_failures_24h,
       SUM(CASE WHEN health_sync_failures_24h > 0 THEN 1 ELSE 0 END) AS instances_with_failures
FROM latest_pings;
