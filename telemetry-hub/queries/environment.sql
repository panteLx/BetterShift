-- Runtime distribution across every environment dimension at once.
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
GROUP BY t.key, t.value
ORDER BY dimension, instances DESC;
