"use client";

import type { ReactNode } from "react";
import type { FormState } from "@/lib/data/types";
import { ActionForm } from "./forms";
import { inputCls, labelCls } from "./styles";

/** A collapsible "Import from a CSV file" form with a downloadable sample. Parsing happens on the server. */
export function CsvImport({
  action,
  hint,
  sample,
  sampleName,
  children,
  className = "mt-6 border-t border-line pt-4",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  hint: ReactNode;
  sample: string;
  sampleName: string;
  /** Extra form fields, such as a default type. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group ${className}`}>
      <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span> Import from a CSV file
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {hint}{" "}
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`} download={sampleName} className="text-accent underline">
          Download a sample
        </a>
      </p>
      <ActionForm action={action} submitLabel="Import" pendingLabel="Importing…" resetOnSuccess className="mt-3">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>CSV file</span>
            <input name="file" type="file" required accept=".csv,.tsv,.txt,text/csv" className={`${inputCls} py-2 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:text-ink`} />
          </label>
          {children}
        </div>
      </ActionForm>
    </details>
  );
}
