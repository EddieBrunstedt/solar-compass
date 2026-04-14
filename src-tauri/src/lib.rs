#[cfg(target_os = "android")]
#[tauri::command]
fn is_24_hour_format() -> Result<bool, String> {
    use jni::objects::JObject;
    use jni::JavaVM;

    let ctx = ndk_context::android_context();
    let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context = unsafe { JObject::from_raw(ctx.context().cast()) };

    let result = env
        .call_static_method(
            "android/text/format/DateFormat",
            "is24HourFormat",
            "(Landroid/content/Context;)Z",
            &[(&context).into()],
        )
        .map_err(|e| e.to_string())?;

    result.z().map_err(|e| e.to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn is_24_hour_format() -> Result<bool, String> {
    Ok(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_geolocation::init())
        .invoke_handler(tauri::generate_handler![is_24_hour_format])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
