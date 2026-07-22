export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<{ event?: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let event: string | undefined;

      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data) {
            yield { event, data };
          }
          event = undefined;
        } else if (line === '') {
          event = undefined;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function extractOpenAIDelta(data: string): string | null {
  if (data === '[DONE]') return null;
  try {
    const parsed = JSON.parse(data) as {
      choices?: { delta?: { content?: string } }[];
    };
    return parsed.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

export function extractAnthropicDelta(event: string | undefined, data: string): string | null {
  try {
    const parsed = JSON.parse(data) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (
      event === 'content_block_delta' ||
      parsed.type === 'content_block_delta'
    ) {
      return parsed.delta?.text ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractGeminiDelta(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const parts = parsed.candidates?.[0]?.content?.parts;
    if (!parts) return null;
    return parts.map((p) => p.text ?? '').join('');
  } catch {
    return null;
  }
}

export async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text.slice(0, 200);
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}
