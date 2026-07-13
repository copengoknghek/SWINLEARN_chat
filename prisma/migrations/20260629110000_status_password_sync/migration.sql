UPDATE `users`
SET `status` = CASE WHEN `must_change_password` = 1 THEN 'inactive' ELSE 'active' END;
