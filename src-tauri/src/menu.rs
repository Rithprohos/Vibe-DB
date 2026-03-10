use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter};

pub fn setup_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let about = MenuItem::with_id(app, "about", "About VibeDB", true, None::<&str>)?;
    let check_updates = MenuItem::with_id(
        app,
        "check_updates",
        "Check for Updates",
        true,
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = PredefinedMenuItem::quit(app, None)?;
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;

    let app_submenu =
        Submenu::with_items(app, "Vibe DB", true, &[&about, &separator, &check_updates, &separator, &quit])?;
    let edit_submenu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &undo,
            &redo,
            &separator,
            &cut,
            &copy,
            &paste,
            &separator,
            &select_all,
        ],
    )?;

    let menu = Menu::with_items(
        app,
        &[
            &app_submenu,
            &Submenu::new(app, "File", true)?,
            &edit_submenu,
            &Submenu::new(app, "View", true)?,
        ],
    )?;

    app.set_menu(menu)?;

    let app_handle = app.clone();
    app.on_menu_event(move |_app, event| {
        if event.id() == "check_updates" {
            let _ = app_handle.emit("vibedb:check-updates", ());
        }
    });

    Ok(())
}
