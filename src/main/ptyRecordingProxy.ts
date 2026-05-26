/**
 * ptyRecordingProxy.ts — PTY recording start/stop dispatch helpers.
 *
 * Extracted from pty.ts (line-limit split). Routes recording calls to either
 * the ptyHost proxy or the direct ptyRecording implementation depending on the
 * usePtyHost flag.
 */

import { BrowserWindow } from 'electron';

import { getConfigValue } from './config';
import { recordings, sessions } from './pty';
import { getProxySession } from './ptyHost/ptyHostProxy';
import { startRecordingViaPtyHost, stopRecordingViaPtyHost } from './ptyHost/ptyHostProxyRecording';
import {
  startPtyRecording as startRecording,
  stopPtyRecording as stopRecording,
} from './ptyRecording';

function ptyHostEnabled(): boolean {
  return getConfigValue('usePtyHost') === true;
}

export function startPtyRecording(
  id: string,
  win: BrowserWindow,
): { success: boolean; error?: string } {
  if (ptyHostEnabled()) {
    const session = getProxySession(id);
    if (!session) return { success: false, error: `Session ${id} not found` };
    return startRecordingViaPtyHost(id, session.cols, session.rows, win);
  }
  return startRecording(id, sessions, recordings, win);
}

export async function stopPtyRecording(
  id: string,
  win: BrowserWindow,
): Promise<{ success: boolean; filePath?: string; cancelled?: boolean; error?: string }> {
  if (ptyHostEnabled()) return stopRecordingViaPtyHost(id, win);
  return stopRecording(id, recordings, win);
}
