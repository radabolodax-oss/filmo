-- Schema-only snapshot of the `movix` database (structure, no data).
-- Generated with: mysqldump --no-data --routines --triggers movix
--
-- Most tables also self-create via `CREATE TABLE IF NOT EXISTS` at boot
-- (see app.js, commentsRoutes.js, sharedListsRoutes.js, utils/cloneLinks.js,
-- wrappedRoutes.js) — this file exists so a fresh clone / Docker init
-- (docker-entrypoint-initdb.d) gets the full schema in one shot instead of
-- depending on every route module being hit at least once first.
--
-- Regenerate after a schema change with:
--   mysqldump -h localhost -P 3306 -u <user> -p --no-data --routines --triggers --skip-comments movix > schema_full_init.sql
-- (then strip the leading `mysqldump: Error ... tablespaces` line if present —
-- harmless PROCESS-privilege warning, but invalid as SQL)
--
-- account/OAuth/VIP tables (account_links, oauth_*, vip_*, access_keys, admins)
-- were removed along with the account/login/OAuth-provider/VIP-payment system —
-- unused (0 rows) before removal. `user_sessions` is kept: getAuthIfValid()
-- in middleware/auth.js still queries it for optional-login-enhancement paths
-- in routes/sync.js and routes/darkiworld.js (both otherwise-unrelated, kept
-- features) — harmless now that no login flow can ever populate it.


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `clone_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clone_links` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `provider` enum('uqload') COLLATE utf8mb4_unicode_ci NOT NULL,
  `media_type` enum('movie','tv') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tmdb_id` int NOT NULL,
  `season_number` int NOT NULL DEFAULT '0',
  `episode_number` int NOT NULL DEFAULT '0',
  `source_file_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clone_file_code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clone_embed_url` varchar(2048) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','ready','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `last_checked_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_clone_scope` (`provider`,`media_type`,`tmdb_id`,`season_number`,`episode_number`,`source_file_code`),
  KEY `idx_clone_lookup` (`media_type`,`tmdb_id`,`season_number`,`episode_number`),
  KEY `idx_clone_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `download_links_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `download_links_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `admin_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_auth_type` enum('oauth','bip-39') COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` enum('added','removed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `media_type` enum('movie','tv') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tmdb_id` bigint NOT NULL,
  `season` int DEFAULT NULL,
  `episode` int DEFAULT NULL,
  `link_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link_type` enum('streaming','download') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'download',
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dlh_admin` (`admin_id`,`admin_auth_type`),
  KEY `idx_dlh_changed` (`changed_at`),
  KEY `idx_dlh_action` (`action`),
  KEY `idx_dlh_link_type` (`link_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `films`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `films` (
  `id` int NOT NULL,
  `links` json DEFAULT NULL,
  `download_links` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_films_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `link_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `link_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tmdb_id` int NOT NULL,
  `media_type` enum('movie','tv') COLLATE utf8mb4_unicode_ci NOT NULL,
  `season_number` int DEFAULT NULL,
  `episode_number` int DEFAULT NULL,
  `url` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `reviewed_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ls_status` (`status`),
  KEY `idx_ls_profile` (`profile_id`),
  KEY `idx_ls_tmdb` (`tmdb_id`,`media_type`),
  KEY `idx_ls_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `series`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `series` (
  `id` int NOT NULL AUTO_INCREMENT,
  `series_id` int NOT NULL,
  `season_number` int NOT NULL,
  `episode_number` int NOT NULL,
  `links` json DEFAULT NULL,
  `download_links` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_series_episode` (`series_id`,`season_number`,`episode_number`),
  KEY `idx_series_id` (`series_id`),
  KEY `idx_series_season` (`series_id`,`season_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_type` enum('oauth','bip39') COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `accessed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_sessions_user` (`user_id`,`user_type`),
  KEY `idx_user_sessions_accessed` (`accessed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `wrapped_pages_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wrapped_pages_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `page_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration` int DEFAULT '0',
  `meta_data` json DEFAULT NULL,
  `month` int NOT NULL,
  `year` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_page_stats` (`user_id`,`page_name`,`year`),
  KEY `idx_page_lookup` (`user_id`,`profile_id`,`page_name`,`month`,`year`),
  KEY `idx_page_generate` (`user_id`,`year`,`profile_id`,`page_name`,`duration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `wrapped_viewing_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wrapped_viewing_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content_type` enum('movie','tv','anime','live-tv') COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `season_number` int DEFAULT NULL,
  `episode_number` int DEFAULT NULL,
  `watch_duration` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `hour_of_day` tinyint DEFAULT NULL,
  `month` int NOT NULL,
  `year` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_year` (`user_id`,`year`),
  KEY `idx_content` (`content_type`,`content_id`),
  KEY `idx_hour` (`user_id`,`year`,`hour_of_day`),
  KEY `idx_viewing_lookup` (`user_id`,`profile_id`,`content_type`,`content_id`,`month`,`year`,`hour_of_day`),
  KEY `idx_year` (`year`),
  KEY `idx_generate_cover` (`user_id`,`year`,`profile_id`,`content_type`,`content_id`,`watch_duration`),
  KEY `idx_user_year_created` (`user_id`,`year`,`created_at`),
  KEY `idx_percentile_cover` (`year`,`user_id`,`watch_duration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

