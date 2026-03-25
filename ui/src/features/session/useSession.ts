/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Session Logic Hook
 */

import { useState } from 'react';
import { exportSkill as apiExportSkill } from '../../api';

export function useSessionExport() {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (sessionId: string) => {
    setExporting(true);
    setError(null);
    try {
      await apiExportSkill(sessionId);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (e) {
      setError('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return { handleExport, exporting, exported, error };
}
