PRAGMA foreign_keys = ON;
PRAGMA journal_mode = DELETE;

CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    homepage_url TEXT,
    api_url TEXT,
    country_code TEXT,
    attribution TEXT,
    license_name TEXT,
    license_url TEXT,
    terms_url TEXT,
    refresh_seconds INTEGER NOT NULL DEFAULT 300,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cameras (
    id TEXT PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
    external_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    country_code TEXT,
    country_name TEXT,
    region TEXT,
    province TEXT,
    city TEXT,
    locality TEXT,
    latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
    altitude_m REAL,
    timezone TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    media_type TEXT NOT NULL CHECK(media_type IN ('snapshot','image','mjpeg','hls','video','youtube','iframe','link')),
    stream_url TEXT,
    embed_url TEXT,
    snapshot_url TEXT,
    source_page_url TEXT,
    thumbnail_url TEXT,
    refresh_seconds INTEGER,
    is_live INTEGER NOT NULL DEFAULT 0 CHECK(is_live IN (0,1)),
    is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0,1)),
    is_embeddable INTEGER NOT NULL DEFAULT 1 CHECK(is_embeddable IN (0,1)),
    status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('online','unknown','offline','blocked')),
    status_reason TEXT,
    width_px INTEGER,
    height_px INTEGER,
    fps REAL,
    orientation_degrees REAL,
    view_direction TEXT,
    language TEXT,
    attribution TEXT,
    license_name TEXT,
    license_url TEXT,
    terms_url TEXT,
    privacy_level TEXT NOT NULL DEFAULT 'public-landscape',
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    priority INTEGER NOT NULL DEFAULT 0,
    first_seen_at TEXT,
    last_seen_at TEXT,
    last_checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_payload_json TEXT,
    checksum TEXT,
    UNIQUE(provider_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_cameras_geo ON cameras(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cameras_country ON cameras(country_code, country_name);
CREATE INDEX IF NOT EXISTS idx_cameras_category ON cameras(category);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status, active);
CREATE INDEX IF NOT EXISTS idx_cameras_provider ON cameras(provider_id);
CREATE INDEX IF NOT EXISTS idx_cameras_media_type ON cameras(media_type);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS camera_tags (
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY(camera_id, tag_id)
);

CREATE TABLE IF NOT EXISTS health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    http_status INTEGER,
    response_ms INTEGER,
    content_type TEXT,
    content_length INTEGER,
    final_url TEXT,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_health_camera_time ON health_checks(camera_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    fetched_count INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    message TEXT
);

CREATE VIEW IF NOT EXISTS camera_catalog AS
SELECT
    c.id,
    p.code AS provider_code,
    p.name AS provider_name,
    c.external_id,
    c.title,
    c.description,
    c.country_code,
    c.country_name,
    c.region,
    c.province,
    c.city,
    c.locality,
    c.latitude,
    c.longitude,
    c.altitude_m,
    c.timezone,
    c.category,
    c.media_type,
    c.stream_url,
    c.embed_url,
    c.snapshot_url,
    c.source_page_url,
    c.thumbnail_url,
    COALESCE(c.refresh_seconds, p.refresh_seconds) AS refresh_seconds,
    c.is_live,
    c.is_public,
    c.is_embeddable,
    c.status,
    c.status_reason,
    c.width_px,
    c.height_px,
    c.fps,
    c.orientation_degrees,
    c.view_direction,
    c.language,
    COALESCE(c.attribution, p.attribution) AS attribution,
    COALESCE(c.license_name, p.license_name) AS license_name,
    COALESCE(c.license_url, p.license_url) AS license_url,
    COALESCE(c.terms_url, p.terms_url) AS terms_url,
    c.privacy_level,
    c.active,
    c.priority,
    c.first_seen_at,
    c.last_seen_at,
    c.last_checked_at,
    c.updated_at
FROM cameras c
JOIN providers p ON p.id = c.provider_id;
