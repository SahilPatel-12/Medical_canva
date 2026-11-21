"use client";

import { useCallback, useRef, useState } from "react";
import type { DesignDocument } from "@design-platform/types";
import { downloadBlob, exportDesignToPdf, pdfFileName } from "@design-platform/editor";

export interface PdfExportProgress {
  done: number;
  total: number;
}

/**
 * Downloads the whole design (every page) as a PDF.
 * `progress` is non-null while an export is running; a second click while busy is ignored.
 */
export function usePdfExport(getDocument: () => DesignDocument) {
  const [progress, setProgress] = useState<PdfExportProgress | null>(null);
  const busyRef = useRef(false);

  const exportPdf = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const doc = getDocument();
    setProgress({ done: 0, total: doc.pages?.length || 1 });
    try {
      const blob = await exportDesignToPdf(doc, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      downloadBlob(blob, pdfFileName(doc.name));
    } catch (err) {
      console.error("[PDF export] failed:", err);
      alert(`Unable to export PDF. ${(err as Error)?.message || ""}`.trim());
    } finally {
      busyRef.current = false;
      setProgress(null);
    }
  }, [getDocument]);

  return { exportPdf, pdfProgress: progress };
}
