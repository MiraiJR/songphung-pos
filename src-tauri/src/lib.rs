mod commands;
mod database;
mod models;
mod printer;

use database::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state = tauri::async_runtime::block_on(DbState::new())
        .expect("failed to initialize SQLite pool");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(db_state)
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::seed_demo_data,
            commands::list_rooms,
            commands::create_room,
            commands::update_room,
            commands::delete_room,
            commands::list_product_groups,
            commands::create_product_group,
            commands::update_product_group,
            commands::delete_product_group,
            commands::list_products,
            commands::create_product,
            commands::update_product,
            commands::delete_product,
            commands::start_room,
            commands::get_active_history_id,
            commands::add_or_update_order_item,
            commands::remove_order_item,
            commands::cancel_room,
            commands::checkout_room,
            commands::get_system_printers,
            commands::test_printer,
            commands::check_printer_connection,
            commands::reprint_history_bill,
            commands::get_current_session,
            commands::list_paid_history,
            commands::get_history_order_items
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
