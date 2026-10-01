import React from "react";
import { toast as rtToast, ToastOptions } from "react-toastify";

export interface CustomToastOptions extends Omit<ToastOptions, "toastId"> {
  id?: string | number;
  toastId?: string | number;
  description?: string;
  duration?: number;
}

function normalizeOpts(opts?: CustomToastOptions): ToastOptions | undefined {
  if (!opts) return undefined;
  const { id, toastId, duration, description, autoClose, ...rest } = opts;
  const out: ToastOptions = { ...rest };
  const effectiveId = toastId ?? id;
  if (effectiveId !== undefined) {
    out.toastId = effectiveId;
  }
  const effectiveAutoClose = autoClose ?? duration;
  if (effectiveAutoClose !== undefined) {
    out.autoClose = effectiveAutoClose;
  }
  return out;
}

function formatMessage(message: any, opts?: CustomToastOptions) {
  if (opts?.description) {
    return React.createElement(
      "div",
      { className: "flex flex-col gap-0.5" },
      React.createElement("span", { className: "font-bold text-foreground text-sm" }, message),
      React.createElement("span", { className: "text-xs text-muted-foreground font-normal" }, opts.description)
    );
  }
  return message;
}

export const toast = Object.assign(
  (msg: any, opts?: CustomToastOptions) => rtToast(formatMessage(msg, opts), normalizeOpts(opts)),
  {
    success: (msg: any, opts?: CustomToastOptions) => rtToast.success(formatMessage(msg, opts), normalizeOpts(opts)),
    error: (msg: any, opts?: CustomToastOptions) => rtToast.error(formatMessage(msg, opts), normalizeOpts(opts)),
    info: (msg: any, opts?: CustomToastOptions) => rtToast.info(formatMessage(msg, opts), normalizeOpts(opts)),
    warning: (msg: any, opts?: CustomToastOptions) => rtToast.warning(formatMessage(msg, opts), normalizeOpts(opts)),
    warn: (msg: any, opts?: CustomToastOptions) => rtToast.warn(formatMessage(msg, opts), normalizeOpts(opts)),
    dismiss: (id?: any) => rtToast.dismiss(id),
    loading: (msg: any, opts?: CustomToastOptions) => rtToast.loading(formatMessage(msg, opts), normalizeOpts(opts)),
  }
);

export default toast;
