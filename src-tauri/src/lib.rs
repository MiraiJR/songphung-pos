mod bill_qr;
mod commands;
mod csv_import;
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
        .plugin(tauri_plugin_dialog::init())
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
            commands::transfer_room,
            commands::get_active_history_id,
            commands::add_or_update_order_item,
            commands::remove_order_item,
            commands::cancel_room,
            commands::checkout_room,
            commands::get_system_printers,
            commands::get_sample_receipt_preview,
            commands::get_bill_qr_preview_data_url,
            commands::save_bill_qr_png,
            commands::reset_bill_qr_png,
            commands::test_printer,
            commands::print_temporary_bill,
            commands::check_printer_connection,
            commands::reprint_history_bill,
            commands::get_current_session,
            commands::list_paid_history,
            commands::get_history_order_items,
            commands::update_paid_history_bill,
            commands::delete_history_by_ids,
            commands::delete_history_by_range,
            csv_import::export_csv_templates,
            csv_import::export_nhom_san_pham_template,
            csv_import::export_san_pham_template,
            csv_import::import_categories_csv,
            csv_import::import_products_csv
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
