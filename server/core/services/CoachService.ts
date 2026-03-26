/**
 * @license
 * Copyright 2026 Google LLC
 * Gemini Chat Analyze - Coach Service (Quality & Suggestions)
 */

import { TaskCategory, SessionMessage } from '../../types/index.js';

export class CoachService {
  /**
   * Calculate quality score based on corrections and first prompt
   */
  calculateQualityScore(corrections: number, prompt: string): number {
    if (!prompt) return 100;
    
    let score = 100;
    
    // 1. Correction penalty (highest weight)
    score -= (corrections * 15);
    
    // 2. Length penalty
    if (prompt.length < 10) score -= 15;
    else if (prompt.length < 30) score -= 5;
    
    // 3. Ambiguity penalty
    const ambiguities = this.detectAmbiguities(prompt);
    score -= (ambiguities.length * 10);
    
    // 4. Missing context penalty
    const hasContext = /[/.\w]+\.\w+|`{1,3}|@\w+/.test(prompt);
    if (!hasContext && prompt.length > 20) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Detect linguistic ambiguities in the prompt
   */
  detectAmbiguities(prompt: string): string[] {
    const ambiguities: string[] = [];
    if (!prompt) return ambiguities;

    const dictionary = [
      { pattern: /这个|那个|这些|那些|这儿|那儿/, label: "过度依赖上下文代词" },
      { pattern: /所有的|全部的|整改|整体/, label: "操作范围描述模糊" },
      { pattern: /帮我|帮下|给个|写个/, label: "指令意图过于口语化" },
      { pattern: /快点|立即|马上|给我/, label: "缺乏逻辑引导的紧迫感" },
      { pattern: /类似|差不多|这种/, label: "缺乏具体对比基准" }
    ];

    dictionary.forEach(rule => {
      if (rule.pattern.test(prompt)) {
        ambiguities.push(rule.label);
      }
    });

    if (prompt.length < 15) ambiguities.push("指令信息量过低");

    return [...new Set(ambiguities)];
  }

  /**
   * Generate coaching suggestions based on prompt analysis
   */
  generateSuggestion(prompt: string): string {
    if (!prompt) return "等待您的第一条指令以开始分析。";
    
    const ambiguities = this.detectAmbiguities(prompt);
    const category = this.detectCategory(prompt, []);

    if (ambiguities.length > 0) {
      if (ambiguities.includes("过度依赖上下文代词")) {
        return "建议使用具体的类名、方法名或文件名替换 '这个/那个'，以减少模型理解偏差。";
      }
      if (prompt.length < 15) {
        return "指令过短。尝试采用 [背景] + [任务目标] + [约束条件] 的三段式结构。";
      }
    }

    if (category === 'Coding') {
      return "建议在 Prompt 中明确预期的输入输出，并要求模型在操作前先进行 'Thought' 思考过程。";
    }

    if (category === 'Learning') {
      return "针对学习类任务，可以要求模型 '由浅入深' 或 '提供对比示例'。";
    }

    return "当前提问质量良好。您可以尝试加入 '角色设定'（如：资深架构师）来获取更具深度的回应。";
  }

  /**
   * Classify the session task category
   */
  detectCategory(prompt: string, tools: string[]): TaskCategory {
    // Priority order: Coding -> Ops -> Research -> Investigate -> Arch -> Learning -> General
    if (tools.some(t => ['replace', 'write_file', 'apply_diff'].includes(t))) return 'Coding';
    if (tools.some(t => ['run_shell_command', 'gh'].includes(t))) return 'Ops';
    if (tools.some(t => ['web_fetch', 'google_web_search'].includes(t))) return 'Research';
    if (tools.some(t => ['grep_search', 'glob', 'list_directory'].includes(t))) return 'Investigate';
    
    if (/架构|设计|模式|architecture|design|pattern/.test(prompt.toLowerCase())) return 'Arch';
    if (/解释|如何|原理|学习|explain|how|why|learn/.test(prompt.toLowerCase())) return 'Learning';
    
    return 'General';
  }

  /**
   * Count corrections (implicit and explicit)
   */
  countCorrections(userMsgs: SessionMessage[], allMsgs: SessionMessage[]): number {
    const correctionPatterns = [/不对/, /错误/, /重新/, /理解错/, /不是这个/, /wrong/, /incorrect/, /fix/, /报错/];
    const userCount = userMsgs.filter(m => 
      correctionPatterns.some(p => p.test(m.content.toLowerCase()))
    ).length;

    // Tool failures (implicit correction)
    const toolFailures = allMsgs.flatMap(m => m.toolCalls || [])
      .filter(tc => tc.status === 'failure').length;

    return userCount + toolFailures;
  }
}
