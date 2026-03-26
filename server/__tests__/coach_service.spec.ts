


import { describe, it, expect, beforeEach } from 'vitest';
import { CoachService } from '../core/services/CoachService.js';

describe('CoachService', () => {
  let coachService: CoachService;

  beforeEach(() => {
    coachService = new CoachService();
  });

  describe('calculateQualityScore', () => {
    it('should return 100 for an empty prompt', () => {
      expect(coachService.calculateQualityScore(0, '')).toBe(100);
    });

    it('should penalize short prompts', () => {
      const score = coachService.calculateQualityScore(0, 'hello');
      expect(score).toBeLessThan(100);
    });

    it('should penalize corrections', () => {
      const score = coachService.calculateQualityScore(1, 'Long enough prompt that is not short');
      // 100 - 15 (correction) - 10 (no context) = 75
      expect(score).toBe(75);
    });

    it('should penalize ambiguities', () => {
      const score = coachService.calculateQualityScore(0, '帮我整改下这个文件');
      // 100 - 15 (short) - 40 (4 ambiguities: "帮我", "整改", "这个", short) = 45
      expect(score).toBe(45);
    });
  });

  describe('detectAmbiguities', () => {
    it('should detect context-dependent pronouns', () => {
      const result = coachService.detectAmbiguities('这个文件是什么');
      expect(result).toContain('过度依赖上下文代词');
    });

    it('should detect vague scope', () => {
      const result = coachService.detectAmbiguities('所有的都要改');
      expect(result).toContain('操作范围描述模糊');
    });

    it('should detect low information density', () => {
      const result = coachService.detectAmbiguities('hi');
      expect(result).toContain('指令信息量过低');
    });
  });

  describe('detectCategory', () => {
    it('should detect Coding category based on tools', () => {
      expect(coachService.detectCategory('', ['replace'])).toBe('Coding');
    });

    it('should detect Arch category based on prompt', () => {
      expect(coachService.detectCategory('帮我设计一个架构', [])).toBe('Arch');
    });

    it('should default to General', () => {
      expect(coachService.detectCategory('Hello', [])).toBe('General');
    });
  });
});
