mod sync_server;

use serde::Serialize;
use sync_server::SharedState;

#[derive(Serialize)]
struct ServerInfo {
  url: String,
  file_count: usize,
}

#[tauri::command]
async fn start_sync_server(
  paths: Vec<String>,
  state: tauri::State<'_, SharedState>,
) -> Result<ServerInfo, String> {
  let files = sync_server::enumerate_files(&paths);
  let file_count = files.len();

  let port = sync_server::start_server(state.inner().clone(), files).await?;
  let ip = local_ip_address::local_ip().map_err(|e| e.to_string())?;

  Ok(ServerInfo {
    url: format!("http://{}:{}", ip, port),
    file_count,
  })
}

#[tauri::command]
async fn stop_sync_server(state: tauri::State<'_, SharedState>) -> Result<(), String> {
  sync_server::stop_server(state.inner().clone()).await;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(SharedState::default())
    .invoke_handler(tauri::generate_handler![start_sync_server, stop_sync_server])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
