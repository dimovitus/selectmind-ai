import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Action } from '@/domain/action/action.schema';
import { rpcClient } from '@/infrastructure/messaging/rpc-client';
import { ActionEditor } from '@/options/ActionEditor';
import { ActionsSection } from '@/options/ActionsSection';
import type { CustomActionTemplate } from '@/shared/constants/custom-action-templates';

type EditorState =
  | null
  | { mode: 'new'; template?: CustomActionTemplate }
  | { mode: 'edit'; action: Action }
  | { mode: 'duplicate'; action: Action };

export function DesktopActionsSettings() {
  const [editor, setEditor] = useState<EditorState>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => rpcClient.call('settings:get', undefined),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['actions', settings?.responseLanguage ?? 'auto'],
    queryFn: () => rpcClient.call('action:list', undefined),
    enabled: !!settings,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => rpcClient.call('category:list', undefined),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => rpcClient.call('provider:list', undefined),
  });

  return (
    <>
      <ActionsSection
        actions={actions}
        categories={categories}
        onCreateCustom={() => setEditor({ mode: 'new' })}
        onEditAction={(action) => setEditor({ mode: 'edit', action })}
        onDuplicateAction={(action) => setEditor({ mode: 'duplicate', action })}
      />

      {editor ? (
        <ActionEditor
          action={editor.mode === 'edit' ? editor.action : null}
          duplicateFrom={editor.mode === 'duplicate' ? editor.action : null}
          template={editor.mode === 'new' ? (editor.template ?? null) : null}
          categories={categories}
          providers={providers}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </>
  );
}
