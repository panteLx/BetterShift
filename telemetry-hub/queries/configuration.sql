-- How instances are configured. Boolean settings show as 1 / 0.
-- json_object + json_each unpivots the columns; D1 caps a compound SELECT at 5 terms.
SELECT t.key AS setting, t.value AS value, COUNT(*) AS instances
FROM latest_pings AS p,
     json_each(json_object(
       'auth_enabled', p.config_auth_enabled,
       'guest_access', p.config_guest_access,
       'registration_open', p.config_registration_open,
       'update_check_enabled', p.config_update_check_enabled,
       'default_locale', p.config_default_locale,
       'rate_limit_overrides', p.config_rate_limit_overrides
     )) AS t
GROUP BY t.key, t.value
ORDER BY setting, instances DESC;
