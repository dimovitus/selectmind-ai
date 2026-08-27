export async function invoke<T>(cmd: string): Promise<T> {
  if (cmd === 'capture_screen_stub') {
    return 'data:image/png;base64,stub' as T;
  }
  throw new Error(`Unknown Tauri command: ${cmd}`);
}
