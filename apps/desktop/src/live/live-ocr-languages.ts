import { invoke } from '@tauri-apps/api/core';

export async function listInstalledOcrLanguages(): Promise<string[]> {
  return invoke<string[]>('ocr_list_languages');
}
