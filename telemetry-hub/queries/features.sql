-- Feature adoption, for the current population -- instances whose newest ping is
-- within the last 30 days, matching the public page and /data.json. Boolean
-- features show as 1 / 0, the rest as buckets.
-- json_object + json_each unpivots the columns; D1 caps a compound SELECT at 5 terms.
SELECT t.key AS dimension, t.value AS value, COUNT(*) AS instances
FROM latest_pings AS p,
     json_each(json_object(
       'external_syncs', p.features_external_syncs,
       'calendar_view_overrides', p.features_calendar_view_overrides,
       'custom_fields_count', p.features_custom_fields_count,
       'archived_presets', p.features_archived_presets,
       'split_shifts', p.features_split_shifts
     )) AS t
WHERE datetime(p.received_at) >= datetime('now', '-30 days')
GROUP BY t.key, t.value
ORDER BY dimension, instances DESC;
