-- Instance sizes. Values are the buckets documented in docs/TELEMETRY.md, never exact counts.
-- json_object + json_each unpivots the columns; D1 caps a compound SELECT at 5 terms.
SELECT t.key AS dimension, t.value AS bucket, COUNT(*) AS instances
FROM latest_pings AS p,
     json_each(json_object(
       'users', p.scale_users,
       'calendars', p.scale_calendars,
       'shifts', p.scale_shifts,
       'presets', p.scale_presets,
       'notes', p.scale_notes,
       'bundles', p.scale_bundles,
       'shares', p.scale_shares,
       'access_tokens', p.scale_access_tokens,
       'signups', p.scale_signups
     )) AS t
GROUP BY t.key, t.value
ORDER BY dimension, instances DESC;
