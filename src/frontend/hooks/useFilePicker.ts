/**
 * useFilePicker — system-level file/directory interactions.
 *
 * Directory selection: since this is a server-side app, "selecting a directory"
 * means entering a server path as text. We use the dialog store's prompt for
 * this — it's not a native browser file picker because the paths refer to the
 * server's filesystem, not the user's local machine.
 *
 * File picking (e.g. CSV import): use a hidden <input type="file"> — handled
 * directly in the component that needs it, not through this hook.
 */

import { useDialogStore } from '../stores/dialog.store';

export function useFilePicker() {
  const { prompt } = useDialogStore();

  const pickDirectory = async (opts: {
    title: string;
    description?: string;
    defaultValue?: string;
    placeholder?: string;
  }): Promise<string | null> => {
    return prompt({
      title: opts.title,
      description: opts.description ?? 'Enter the absolute path on the server.',
      defaultValue: opts.defaultValue,
      placeholder: opts.placeholder ?? '/home/user/projects/my-app',
    });
  };

  return { pickDirectory };
}
