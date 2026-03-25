/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - DiscoveryService Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiscoveryService } from '../core/services/DiscoveryService.js';
import path from 'node:path';

describe('DiscoveryService', () => {
  let discoveryService: DiscoveryService;

  beforeEach(() => {
    discoveryService = new DiscoveryService();
  });

  describe('resolveProjectName', () => {
    it('should resolve project name from first subdirectory level', () => {
      const watchPaths = ['/home/user/.gemini/tmp'];
      const filePath = '/home/user/.gemini/tmp/my-project/chats/session-1.json';
      expect(discoveryService.resolveProjectName(filePath, watchPaths)).toBe('my-project');
    });

    it('should return "Imported" for files directly in watch path', () => {
      const watchPaths = ['/home/user/chats'];
      const filePath = '/home/user/chats/direct.json';
      expect(discoveryService.resolveProjectName(filePath, watchPaths)).toBe('Imported');
    });

    it('should return "Unknown" for files outside watch paths', () => {
      const watchPaths = ['/home/user/chats'];
      const filePath = '/etc/passwd';
      expect(discoveryService.resolveProjectName(filePath, watchPaths)).toBe('Unknown');
    });
  });
});
