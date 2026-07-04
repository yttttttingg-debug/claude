import crypto from 'node:crypto';

export type ApprovalAction = 'approve' | 'revise' | 'cancel';

export interface ApprovalResult {
  action: ApprovalAction;
  feedback?: string;
}

const pendingApprovals = new Map<string, {
  resolve: (r: ApprovalResult) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

const pendingTextInputs = new Map<string, (text: string) => void>();

export function newApprovalId(): string {
  return crypto.randomBytes(6).toString('hex');
}

export function waitForApproval(id: string, timeoutMs = 24 * 3600 * 1000): Promise<ApprovalResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(id);
      reject(new Error('審核逾時（24小時無回應），已自動取消'));
    }, timeoutMs);
    pendingApprovals.set(id, { resolve, timer });
  });
}

export function resolveApproval(id: string, action: ApprovalAction, feedback?: string): boolean {
  const entry = pendingApprovals.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pendingApprovals.delete(id);
  entry.resolve({ action, feedback });
  return true;
}

export function waitForTextInput(chatId: string | number, timeoutMs = 10 * 60 * 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const key = String(chatId);
    const timer = setTimeout(() => {
      pendingTextInputs.delete(key);
      reject(new Error('等待輸入逾時（10分鐘無回應）'));
    }, timeoutMs);
    pendingTextInputs.set(key, (text: string) => {
      clearTimeout(timer);
      resolve(text);
    });
  });
}

export function resolveTextInput(chatId: string | number, text: string): boolean {
  const key = String(chatId);
  const fn = pendingTextInputs.get(key);
  if (!fn) return false;
  pendingTextInputs.delete(key);
  fn(text);
  return true;
}
