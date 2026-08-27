use std::sync::mpsc;
use std::sync::OnceLock;
use std::thread;

use uiautomation::UIAutomation;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};

struct UiaWorker {
    sender: mpsc::Sender<Box<dyn FnOnce(&UIAutomation) + Send>>,
}

static UIA_WORKER: OnceLock<UiaWorker> = OnceLock::new();

fn worker() -> &'static UiaWorker {
    UIA_WORKER.get_or_init(|| {
        let (sender, receiver) = mpsc::channel::<Box<dyn FnOnce(&UIAutomation) + Send>>();

        thread::Builder::new()
            .name("selectmind-uia".into())
            .spawn(move || {
                unsafe {
                    // uiautomation expects MTA — STA here causes RPC_E_CHANGED_MODE.
                    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                }

                let automation = match UIAutomation::new_direct() {
                    Ok(automation) => automation,
                    Err(error) => {
                        eprintln!("[selectmind] UIA worker failed to start: {error}");
                        return;
                    }
                };

                while let Ok(job) = receiver.recv() {
                    job(&automation);
                }

                unsafe {
                    CoUninitialize();
                }
            })
            .expect("failed to spawn UIA worker thread");

        UiaWorker { sender }
    })
}

/// Run UI Automation work on a dedicated MTA thread with a reused client instance.
pub fn run_on_uia_thread<F, R>(operation: F) -> Result<R, String>
where
    F: FnOnce(&UIAutomation) -> Result<R, String> + Send + 'static,
    R: Send + 'static,
{
    let (result_sender, result_receiver) = mpsc::channel();

    worker()
        .sender
        .send(Box::new(move |automation| {
            let _ = result_sender.send(operation(automation));
        }))
        .map_err(|error| format!("UIA worker unavailable: {error}"))?;

    result_receiver
        .recv()
        .map_err(|error| format!("UIA worker dropped: {error}"))?
}
