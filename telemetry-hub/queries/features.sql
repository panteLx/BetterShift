-- Feature adoption. Boolean features show as 1 / 0, the rest as buckets.
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
GROUP BY t.key, t.value
ORDER BY dimension, instances DESC;
