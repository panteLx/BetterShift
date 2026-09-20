-- Instances seen per day. A ping without an instance id counts as its own instance.
SELECT ping_day AS day,
       COUNT(DISTINCT COALESCE(instance_id, 'anon:' || id)) AS instances,
       COUNT(*) AS pings,
       SUM(CASE WHEN app_is_dev = 1 THEN 1 ELSE 0 END) AS dev_pings
FROM instance_pings
GROUP BY ping_day
ORDER BY day DESC
LIMIT 60;
