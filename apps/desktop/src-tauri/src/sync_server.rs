use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

use axum::extract::connect_info::ConnectInfo;
use axum::extract::{Path as AxumPath, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use tokio::sync::{oneshot, Mutex};

#[derive(Clone, Serialize)]
pub struct SyncFile {
  pub id: usize,
  pub name: String,
  pub size: u64,
  #[serde(skip)]
  pub path: PathBuf,
}

struct ClientActivity {
  received_ids: HashSet<usize>,
  last_seen: Instant,
}

#[derive(Clone, Serialize)]
pub struct ClientStatus {
  pub ip: String,
  pub files_received: usize,
  pub total_files: usize,
  pub seconds_since_last_seen: u64,
}

#[derive(Default)]
pub struct SyncServerState {
  files: Mutex<Vec<SyncFile>>,
  shutdown: Mutex<Option<oneshot::Sender<()>>>,
  clients: Mutex<HashMap<String, ClientActivity>>,
}

pub type SharedState = Arc<SyncServerState>;

/// Walks each selected path (file or directory) and collects every regular
/// file found, assigning each a manifest id stable only for this run.
pub fn enumerate_files(roots: &[String]) -> Vec<SyncFile> {
  let mut files = Vec::new();

  for root in roots {
    let root_path = PathBuf::from(root);

    if root_path.is_file() {
      push_file(&mut files, &root_path);
    } else if root_path.is_dir() {
      for entry in walkdir::WalkDir::new(&root_path)
        .into_iter()
        .filter_map(|e| e.ok())
      {
        if entry.file_type().is_file() {
          push_file(&mut files, entry.path());
        }
      }
    }
  }

  files
}

fn push_file(files: &mut Vec<SyncFile>, path: &std::path::Path) {
  let Ok(metadata) = std::fs::metadata(path) else {
    return;
  };
  let name = path
    .file_name()
    .map(|n| n.to_string_lossy().to_string())
    .unwrap_or_else(|| "file".to_string());

  files.push(SyncFile {
    id: files.len(),
    name,
    size: metadata.len(),
    path: path.to_path_buf(),
  });
}

#[derive(Serialize)]
struct ManifestResponse {
  files: Vec<SyncFile>,
}

async fn touch_client(state: &SharedState, addr: SocketAddr, received_id: Option<usize>) {
  let mut clients = state.clients.lock().await;
  let activity = clients
    .entry(addr.ip().to_string())
    .or_insert_with(|| ClientActivity {
      received_ids: HashSet::new(),
      last_seen: Instant::now(),
    });
  activity.last_seen = Instant::now();
  if let Some(id) = received_id {
    activity.received_ids.insert(id);
  }
}

async fn get_manifest(
  State(state): State<SharedState>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Json<ManifestResponse> {
  touch_client(&state, addr, None).await;
  let files = state.files.lock().await.clone();
  Json(ManifestResponse { files })
}

async fn get_file(
  State(state): State<SharedState>,
  ConnectInfo(addr): ConnectInfo<SocketAddr>,
  AxumPath(id): AxumPath<usize>,
) -> Result<impl IntoResponse, StatusCode> {
  let path = {
    let files = state.files.lock().await;
    files.get(id).map(|f| f.path.clone())
  };

  let Some(path) = path else {
    return Err(StatusCode::NOT_FOUND);
  };

  match tokio::fs::read(&path).await {
    Ok(bytes) => {
      touch_client(&state, addr, Some(id)).await;
      Ok(([(header::CONTENT_TYPE, "application/octet-stream")], bytes))
    }
    Err(_) => Err(StatusCode::GONE),
  }
}

/// Snapshots current per-client sync progress for display in the desktop UI.
pub async fn get_clients(state: &SharedState) -> Vec<ClientStatus> {
  let total_files = state.files.lock().await.len();
  let clients = state.clients.lock().await;

  clients
    .iter()
    .map(|(ip, activity)| ClientStatus {
      ip: ip.clone(),
      files_received: activity.received_ids.len(),
      total_files,
      seconds_since_last_seen: activity.last_seen.elapsed().as_secs(),
    })
    .collect()
}

/// Replaces the currently-served file list, binds an ephemeral port, and
/// spawns the axum server in the background. Returns the bound port.
pub async fn start_server(state: SharedState, files: Vec<SyncFile>) -> Result<u16, String> {
  {
    let mut guard = state.files.lock().await;
    *guard = files;
  }
  {
    let mut clients = state.clients.lock().await;
    clients.clear();
  }

  let app = Router::new()
    .route("/manifest", get(get_manifest))
    .route("/files/:id", get(get_file))
    .with_state(state.clone());

  let listener = tokio::net::TcpListener::bind("0.0.0.0:0")
    .await
    .map_err(|e| e.to_string())?;
  let port = listener.local_addr().map_err(|e| e.to_string())?.port();

  let (tx, rx) = oneshot::channel();
  {
    let mut shutdown = state.shutdown.lock().await;
    // Drop any previous handle so an earlier server (if still running) is
    // left to shut down on its own; starting again always binds a fresh port.
    *shutdown = Some(tx);
  }

  tauri::async_runtime::spawn(async move {
    let _ = axum::serve(
      listener,
      app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async {
      let _ = rx.await;
    })
    .await;
  });

  Ok(port)
}

pub async fn stop_server(state: SharedState) {
  let mut shutdown = state.shutdown.lock().await;
  if let Some(tx) = shutdown.take() {
    let _ = tx.send(());
  }
}
