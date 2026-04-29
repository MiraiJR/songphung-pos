use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::{ConnectOptions, SqlitePool};
use std::path::PathBuf;
use std::str::FromStr;

pub struct DbState {
    pool: SqlitePool,
}

impl DbState {
    pub async fn new() -> Result<Self, String> {
        let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| default_database_url());

        let connect_options = SqliteConnectOptions::from_str(&database_url)
            .map_err(|error| format!("invalid DATABASE_URL: {error}"))?
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .disable_statement_logging();

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connect_options)
            .await
            .map_err(|error| format!("failed to connect SQLite: {error}"))?;

        sqlx::migrate!()
            .run(&pool)
            .await
            .map_err(|error| format!("failed to run migration: {error}"))?;

        Ok(Self { pool })
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

fn default_database_url() -> String {
    let base_dir = std::env::var("APPDATA")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("HOME").map(|home| PathBuf::from(home).join(".local/share")))
        .unwrap_or_else(|_| PathBuf::from("."));

    let app_dir = base_dir.join("songphung");
    let _ = std::fs::create_dir_all(&app_dir);
    let db_path = app_dir.join("songphung.db");
    format!("sqlite://{}", db_path.to_string_lossy())
}
