-- Which custom field types are actually used, for the current population --
-- instances whose newest ping is within the last 30 days, matching the public page
-- and /data.json. json_each expands the stored JSON array, so an instance using
-- three types contributes to three rows.
SELECT t.value AS field_type, COUNT(DISTINCT p.id) AS instances
FROM latest_pings AS p, json_each(p.features_custom_field_types) AS t
WHERE datetime(p.received_at) >= datetime('now', '-30 days')
GROUP BY t.value
ORDER BY instances DESC, field_type;
