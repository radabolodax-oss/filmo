-- Schema-only snapshot of the `movix` database (structure, no data).
-- Generated with: mysqldump --no-data --routines --triggers movix
--
-- Most tables also self-create via `CREATE TABLE IF NOT EXISTS` at boot
-- (see app.js, commentsRoutes.js, sharedListsRoutes.js, utils/accountLinks.js,
-- utils/cloneLinks.js, utils/oauthStorage.js, utils/vipDonations.js,
-- wrappedRoutes.js) — this file exists so a fresh clone / Docker init
-- (docker-entrypoint-initdb.d) gets the full schema in one shot instead of
-- depending on every route module being hit at least once first.
--
-- Regenerate after a schema change with:
--   mysqldump -h localhost -P 3306 -u <user> -p --no-data --routines --triggers --skip-comments movix > schema_full_init.sql
-- (then strip the leading `mysqldump: Error ... tablespaces` line if present —
-- harmless PROCESS-privilege warning, but invalid as SQL)

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
DROP TABLE IF EXISTS `account_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_links` (
  `provider` enum('discord','google','bip39') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_user_type` enum('oauth','bip39') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `linked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`provider`,`provider_user_id`),
  UNIQUE KEY `uniq_account_links_target_provider` (`target_user_type`,`target_user_id`,`provider`),
  KEY `idx_account_links_target` (`target_user_type`,`target_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
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
DROP TABLE IF EXISTS `oauth_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_access_tokens` (
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_type` enum('oauth','bip39') COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scopes` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `authorization_code_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token_hash`),
  KEY `idx_oauth_tokens_client` (`client_id`),
  KEY `idx_oauth_tokens_user` (`user_id`,`user_type`),
  KEY `idx_oauth_tokens_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `oauth_app_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_app_stats` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `client_id` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_client_event` (`client_id`,`event_type`,`created_at`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `oauth_authorization_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_authorization_codes` (
  `code_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_type` enum('oauth','bip39') COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scopes` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `redirect_uri` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_challenge` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_challenge_method` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`code_hash`),
  KEY `idx_oauth_codes_client` (`client_id`),
  KEY `idx_oauth_codes_user` (`user_id`,`user_type`),
  KEY `idx_oauth_codes_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `oauth_authorization_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_authorization_requests` (
  `request_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `redirect_uri` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `response_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'code',
  `scopes` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `state` text COLLATE utf8mb4_unicode_ci,
  `code_challenge` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `code_challenge_method` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `decision` enum('approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_hash`),
  KEY `idx_oauth_requests_client` (`client_id`),
  KEY `idx_oauth_requests_expiry` (`expires_at`),
  KEY `idx_oauth_requests_consumed` (`consumed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `oauth_clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_clients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `client_id` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `homepage_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `redirect_uris` json NOT NULL,
  `allowed_scopes` json NOT NULL,
  `public_client` tinyint(1) NOT NULL DEFAULT '1',
  `require_pkce` tinyint(1) NOT NULL DEFAULT '1',
  `client_secret` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon_filename` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vip_days_balance` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` bigint unsigned NOT NULL,
  `updated_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_id` (`client_id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `oauth_vip_grants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `oauth_vip_grants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `client_id` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id_only` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `days_granted` int unsigned NOT NULL,
  `access_key_value` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `granted_at` bigint unsigned NOT NULL,
  `revoked_at` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`,`granted_at`),
  KEY `idx_user_id` (`user_id`,`granted_at`),
  KEY `idx_access_key` (`access_key_value`)
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
DROP TABLE IF EXISTS `vip_derivation_counters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vip_derivation_counters` (
  `coin` enum('btc','ltc') COLLATE utf8mb4_unicode_ci NOT NULL,
  `next_index` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`coin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `vip_invoice_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vip_invoice_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int NOT NULL,
  `event_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_json` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vip_invoice_events_invoice` (`invoice_id`),
  KEY `idx_vip_invoice_events_type` (`event_type`),
  CONSTRAINT `fk_vip_invoice_events_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `vip_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `vip_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vip_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `public_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method` enum('btc','ltc','paygate_hosted','autobuy','payblis') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('awaiting_payment','partial_payment','confirming','paid','delivered','expired','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'awaiting_payment',
  `coin` enum('btc','ltc') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pack_eur` decimal(10,2) NOT NULL,
  `amount_eur` decimal(10,2) NOT NULL,
  `amount_usd` decimal(10,2) NOT NULL,
  `amount_crypto_expected` decimal(20,8) DEFAULT NULL,
  `amount_crypto_received` decimal(20,8) NOT NULL DEFAULT '0.00000000',
  `vip_years` decimal(5,2) NOT NULL,
  `recipient_mode` enum('self','gift') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_address` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `derivation_index` int DEFAULT NULL,
  `confirmations` int NOT NULL DEFAULT '0',
  `required_confirmations` int NOT NULL DEFAULT '1',
  `tx_hash` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qr_payload` text COLLATE utf8mb4_unicode_ci,
  `gift_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gift_sealed` tinyint(1) NOT NULL DEFAULT '1',
  `gift_unsealed_at` datetime DEFAULT NULL,
  `gift_unseal_count` int NOT NULL DEFAULT '0',
  `gift_unsealed_by_ip_hash` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vip_key_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_user_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_user_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_ip_hash` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `next_check_at` datetime DEFAULT NULL,
  `paygate_tracking_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paygate_temporary_wallet_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paygate_callback_url` text COLLATE utf8mb4_unicode_ci,
  `paygate_callback_nonce` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paygate_checkout_url` text COLLATE utf8mb4_unicode_ci,
  `paygate_payer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paygate_paid_coin` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paygate_paid_value` decimal(18,8) DEFAULT NULL,
  `paygate_paid_txid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autobuy_order_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autobuy_product_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autobuy_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autobuy_checkout_url` text COLLATE utf8mb4_unicode_ci,
  `autobuy_gateway` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autobuy_currency` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `autobuy_total` decimal(18,8) DEFAULT NULL,
  `autobuy_order_created_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `payblis_ref_order` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payblis_checkout_url` text COLLATE utf8mb4_unicode_ci,
  `payblis_payer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payblis_customer_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payblis_method` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payblis_transaction_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payblis_paid_amount` decimal(18,2) DEFAULT NULL,
  `payblis_paid_currency` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payblis_ipn_received_at` datetime DEFAULT NULL,
  `payblis_ipn_raw_payload` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `public_id` (`public_id`),
  UNIQUE KEY `gift_token` (`gift_token`),
  UNIQUE KEY `uniq_vip_invoices_autobuy_order_id` (`autobuy_order_id`),
  UNIQUE KEY `uniq_vip_invoices_payblis_ref_order` (`payblis_ref_order`),
  KEY `idx_vip_invoices_payment_method` (`payment_method`),
  KEY `idx_vip_invoices_status` (`status`),
  KEY `idx_vip_invoices_coin` (`coin`),
  KEY `idx_vip_invoices_created_at` (`created_at`),
  KEY `idx_vip_invoices_payment_address` (`payment_address`),
  KEY `idx_vip_invoices_vip_key` (`vip_key_value`),
  KEY `idx_vip_invoices_paygate_paid_txid` (`paygate_paid_txid`),
  KEY `idx_vip_invoices_payblis_tx` (`payblis_transaction_id`)
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

