//! Keeps the live overlay visible on screen while hiding it from screen capture.
//! Requires Windows 10 2004+ (WDA_EXCLUDEFROMCAPTURE).

#[cfg(windows)]
pub fn set_capture_exclusion(hwnd_raw: isize, exclude: bool) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
    };

    if hwnd_raw == 0 {
        return Err("Overlay window handle is not available".to_string());
    }

    let hwnd = HWND(hwnd_raw as *mut core::ffi::c_void);
    let affinity = if exclude {
        WDA_EXCLUDEFROMCAPTURE
    } else {
        WDA_NONE
    };

    unsafe { SetWindowDisplayAffinity(hwnd, affinity) }.map_err(|error| error.to_string())
}

#[cfg(windows)]
pub fn pin_overlay_topmost(hwnd_raw: isize) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
    };

    if hwnd_raw == 0 {
        return Err("Overlay window handle is not available".to_string());
    }

    let hwnd = HWND(hwnd_raw as *mut core::ffi::c_void);
    unsafe {
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
    }
    .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
pub fn set_capture_exclusion(_hwnd_raw: isize, _exclude: bool) -> Result<(), String> {
    Err("Capture exclusion is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn pin_overlay_topmost(_hwnd_raw: isize) -> Result<(), String> {
    Ok(())
}
