-- New installs per day: the first day each instance id was ever seen.
SELECT first_day AS day, COUNT(*) AS new_instances
FROM (
  SELECT instance_id, MIN(ping_day) AS first_day
  FROM instance_pings
  WHERE instance_id IS NOT NULL
  GROUP BY instance_id
)
GROUP BY first_day
ORDER BY day DESC
LIMIT 60;
