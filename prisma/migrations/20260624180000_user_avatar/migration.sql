SET @dbname = DATABASE();
SET @preparedStatement = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.columns
      WHERE table_schema = @dbname
        AND table_name = 'users'
        AND column_name = 'avatar_url'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(191) NULL'
  )
);
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
