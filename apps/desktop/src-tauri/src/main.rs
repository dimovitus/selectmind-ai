// Hide the console window on Windows release builds (GUI app).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    selectmind_desktop_lib::run()
}
