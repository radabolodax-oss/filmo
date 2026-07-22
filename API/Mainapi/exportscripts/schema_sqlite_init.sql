-- SQLite-equivalent schema for the mobile/offline backend (sql.js).
-- Hand-ported from exportscripts/schema_full_init.sql (MySQL) PLUS the
-- tables that only ever self-created via `CREATE TABLE IF NOT EXISTS` at
-- boot in the JS route files (comments, likes, reports, wishboard_*), and
-- a couple of tables (help_feedback) that turned out to have NO creation
-- path anywhere in the current codebase (likely a stale gap in the real
-- MySQL deployment, pre-created out of band) -- reconstructed here from the
-- INSERT/SELECT column usage in routes/helpFeedback.js.
--
-- All tables use `CREATE TABLE IF NOT EXISTS` so this script is safe to run
-- against an already-initialized file (used both for fresh-DB bootstrap and
-- as a defensive re-run on every boot).
--
-- Differences from the MySQL DDL (intentional, SQLite has no equivalents):
--   - AUTO_INCREMENT            -> INTEGER PRIMARY KEY AUTOINCREMENT
--   - ENGINE=InnoDB / CHARSET   -> dropped (no SQLite equivalent, no-op)
--   - ENUM(...)                 -> TEXT (SQLite has no enum type; app code
--                                  already validates values before insert)
--   - inline INDEX/KEY (...)    -> separate CREATE INDEX statements below
--   - ON UPDATE CURRENT_TIMESTAMP -> not supported; call sites that need a
--                                  fresh updated_at already pass one explicitly
--                                  (server-side default via mysqlPoolSqlite's
--                                  NOW()/CURRENT_TIMESTAMP translation covers
--                                  the rest)

-- NOTE: no PRAGMA journal_mode here -- sql.js is a pure in-memory engine
-- (the whole DB lives in a WASM heap buffer and is exported/persisted to
-- disk manually by mysqlPoolSqlite.js), WAL mode has no meaning for it and
-- some builds reject the pragma outright.
PRAGMA foreign_keys = OFF;

-- === From schema_full_init.sql (MySQL) — tables with no JS self-create path ===

CREATE TABLE IF NOT EXISTS films (
  id INTEGER NOT NULL PRIMARY KEY,
  links TEXT,
  download_links TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_films_updated ON films (updated_at);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  links TEXT,
  download_links TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_series_episode UNIQUE (series_id, season_number, episode_number)
);
CREATE INDEX IF NOT EXISTS idx_series_id ON series (series_id);
CREATE INDEX IF NOT EXISTS idx_series_season ON series (series_id, season_number);

CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  user_type TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_accessed ON user_sessions (accessed_at);

-- === Tables that DO self-create via `CREATE TABLE IF NOT EXISTS` in the JS
-- (app.js / commentsRoutes.js / sharedListsRoutes.js / wrappedRoutes.js /
-- utils/cloneLinks.js) -- listed here too so a fresh DB has them immediately
-- rather than depending on route order. Kept in sync with those call sites;
-- harmless duplication since IF NOT EXISTS makes both idempotent.

CREATE TABLE IF NOT EXISTS clone_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  media_type TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL DEFAULT 0,
  episode_number INTEGER NOT NULL DEFAULT 0,
  source_file_code VARCHAR(64) NOT NULL,
  clone_file_code VARCHAR(64) DEFAULT NULL,
  clone_embed_url VARCHAR(2048) DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT DEFAULT NULL,
  last_checked_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uniq_clone_scope UNIQUE (provider, media_type, tmdb_id, season_number, episode_number, source_file_code)
);
CREATE INDEX IF NOT EXISTS idx_clone_lookup ON clone_links (media_type, tmdb_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_clone_status ON clone_links (status);

CREATE TABLE IF NOT EXISTS link_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id VARCHAR(255) NOT NULL,
  profile_id VARCHAR(255) NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  season_number INTEGER DEFAULT NULL,
  episode_number INTEGER DEFAULT NULL,
  url VARCHAR(2048) NOT NULL,
  source_name VARCHAR(100) DEFAULT NULL,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT DEFAULT NULL,
  reviewed_by VARCHAR(255) DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ls_status ON link_submissions (status);
CREATE INDEX IF NOT EXISTS idx_ls_profile ON link_submissions (profile_id);
CREATE INDEX IF NOT EXISTS idx_ls_tmdb ON link_submissions (tmdb_id, media_type);
CREATE INDEX IF NOT EXISTS idx_ls_created ON link_submissions (created_at);

CREATE TABLE IF NOT EXISTS download_links_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id VARCHAR(255) NOT NULL,
  admin_auth_type TEXT NOT NULL,
  action TEXT NOT NULL,
  media_type TEXT NOT NULL,
  tmdb_id BIGINT NOT NULL,
  season INTEGER NULL,
  episode INTEGER NULL,
  link_url TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'download',
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dlh_admin ON download_links_history (admin_id, admin_auth_type);
CREATE INDEX IF NOT EXISTS idx_dlh_changed ON download_links_history (changed_at);
CREATE INDEX IF NOT EXISTS idx_dlh_action ON download_links_history (action);
CREATE INDEX IF NOT EXISTS idx_dlh_link_type ON download_links_history (link_type);

CREATE TABLE IF NOT EXISTS shared_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  profile_id VARCHAR(255) NOT NULL,
  list_id VARCHAR(255) NOT NULL,
  share_code VARCHAR(20) NOT NULL,
  is_public_in_catalog TINYINT(1) NOT NULL DEFAULT 0,
  moderation_flagged TINYINT(1) NOT NULL DEFAULT 0,
  moderation_reason VARCHAR(255),
  moderation_details TEXT,
  moderated_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT uq_share_code UNIQUE (share_code),
  CONSTRAINT uq_user_list UNIQUE (user_id, user_type, profile_id, list_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_lists_share_code ON shared_lists (share_code);
CREATE INDEX IF NOT EXISTS idx_shared_lists_user_profile ON shared_lists (user_id, user_type, profile_id);
CREATE INDEX IF NOT EXISTS idx_shared_lists_moderation ON shared_lists (moderation_flagged, is_public_in_catalog);

CREATE TABLE IF NOT EXISTS wrapped_viewing_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id VARCHAR(255) NOT NULL,
  profile_id VARCHAR(255),
  content_type TEXT NOT NULL,
  content_id VARCHAR(255) NOT NULL,
  content_title VARCHAR(255),
  season_number INTEGER DEFAULT NULL,
  episode_number INTEGER DEFAULT NULL,
  watch_duration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  hour_of_day TINYINT DEFAULT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_year ON wrapped_viewing_data (user_id, year);
CREATE INDEX IF NOT EXISTS idx_content ON wrapped_viewing_data (content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_hour ON wrapped_viewing_data (user_id, year, hour_of_day);

CREATE TABLE IF NOT EXISTS wrapped_pages_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id VARCHAR(255) NOT NULL,
  profile_id VARCHAR(255),
  page_name VARCHAR(100) NOT NULL,
  duration INTEGER DEFAULT 0,
  meta_data TEXT,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_page_stats ON wrapped_pages_data (user_id, page_name, year);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  notifications_disabled TINYINT(1) DEFAULT 0,
  updated_at BIGINT,
  PRIMARY KEY (user_id, user_type)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_user_push ON push_subscriptions (user_id, user_type);

-- === Tables with NO creation path anywhere in the JS (comments, likes,
-- reports, wishboard_*, help_feedback) -- reconstructed from column usage
-- in commentsRoutes.js / likesRoutes.js / wishboardRoutes.js /
-- routes/helpFeedback.js. These normally pre-exist in the real MySQL DB
-- out of band; on SQLite they must be created somewhere, so it's here.

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type VARCHAR(50) NOT NULL,
  content_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  profile_id VARCHAR(255),
  username VARCHAR(255),
  avatar TEXT,
  content TEXT NOT NULL,
  is_spoiler TINYINT(1) NOT NULL DEFAULT 0,
  is_vip TINYINT(1) NOT NULL DEFAULT 0,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  is_edited TINYINT(1) NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  moderation_reason VARCHAR(255) DEFAULT NULL,
  moderation_details TEXT DEFAULT NULL,
  moderated_at BIGINT DEFAULT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT,
  ip_address VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments (content_type, content_id, deleted);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (user_id, user_type);

CREATE TABLE IF NOT EXISTS comment_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  parent_reply_id INTEGER DEFAULT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  profile_id VARCHAR(255),
  username VARCHAR(255),
  avatar TEXT,
  reply_to_username VARCHAR(255),
  content TEXT NOT NULL,
  is_spoiler TINYINT(1) NOT NULL DEFAULT 0,
  is_vip TINYINT(1) NOT NULL DEFAULT 0,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  is_edited TINYINT(1) NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  moderation_reason VARCHAR(255) DEFAULT NULL,
  moderation_details TEXT DEFAULT NULL,
  moderated_at BIGINT DEFAULT NULL,
  hierarchical_path TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT,
  ip_address VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_comment_replies_comment ON comment_replies (comment_id, deleted);
CREATE INDEX IF NOT EXISTS idx_comment_replies_parent ON comment_replies (parent_reply_id);

CREATE TABLE IF NOT EXISTS comment_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type VARCHAR(20) NOT NULL,
  target_id INTEGER NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  profile_id VARCHAR(255),
  created_at BIGINT NOT NULL,
  CONSTRAINT uq_comment_reaction UNIQUE (target_type, target_id, user_id, user_type, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_target ON comment_reactions (target_type, target_id);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_type VARCHAR(50) NOT NULL,
  content_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  profile_id VARCHAR(255),
  vote_type VARCHAR(20) NOT NULL,
  created_at BIGINT NOT NULL,
  CONSTRAINT uq_like_vote UNIQUE (content_type, content_id, user_id, user_type, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_content ON likes (content_type, content_id);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_user_id VARCHAR(255) NOT NULL,
  reporter_user_type VARCHAR(50) NOT NULL,
  reporter_profile_id VARCHAR(255),
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  reason VARCHAR(255),
  details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports (target_type, target_id, status);

CREATE TABLE IF NOT EXISTS wishboard_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id VARCHAR(255) NOT NULL,
  profile_id VARCHAR(255) NOT NULL,
  tmdb_id INTEGER NOT NULL,
  media_type VARCHAR(20) NOT NULL,
  season_number INTEGER DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wishboard_requests_status ON wishboard_requests (status);
CREATE INDEX IF NOT EXISTS idx_wishboard_requests_tmdb ON wishboard_requests (tmdb_id, media_type);

CREATE TABLE IF NOT EXISTS wishboard_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  profile_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_wishboard_vote UNIQUE (request_id, user_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_wishboard_votes_request ON wishboard_votes (request_id);

CREATE TABLE IF NOT EXISTS wishboard_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  admin_id VARCHAR(255),
  note TEXT,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_wishboard_note_request UNIQUE (request_id)
);

CREATE TABLE IF NOT EXISTS wishboard_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  reason TEXT,
  admin_id VARCHAR(255),
  admin_auth_type VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wishboard_status_history_request ON wishboard_status_history (request_id);

CREATE TABLE IF NOT EXISTS help_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug VARCHAR(100) NOT NULL,
  helpful TINYINT(1) NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_help_feedback_vote UNIQUE (slug, ip_hash)
);
CREATE INDEX IF NOT EXISTS idx_help_feedback_slug ON help_feedback (slug);
