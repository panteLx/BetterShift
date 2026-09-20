-- Runtime distribution across every environment dimension at once, for the current
-- population -- instances whose newest ping is within the last 30 days, matching
-- the public page and /data.json.
-- json_object + json_each unpivots the columns; D1 caps a compound SELECT at 5 terms.
SELECT t.key AS dimension, t.value AS value, COUNT(*) AS instances
FROM latest_pings AS p,
     json_each(json_object(
       'node', p.runtime_node,
       'platform', p.runtime_platform,
       'arch', p.runtime_arch,
       'sqlite', p.runtime_sqlite,
       'timezone', p.runtime_timezone
     )) AS t
WHERE datetime(p.received_at) >= datetime('now', '-30 days')
GROUP BY t.key, t.value
ORDER BY dimension, instances DESC;
