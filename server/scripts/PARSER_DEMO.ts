/**
 * @license
 * Copyright 2025 Google LLC
 * Gemini Chat Analyze - Parser Prototype
 */

import fs from 'node:fs/promises';

/**
 * 核心解析引擎原型
 * 用于从原始会话 JSON 中提取行为特征、模型信息和表达质量数据。
 */
export class SessionParser {
  /**
   * 分析单个会话文件
   * @param filePath 原始 chats/*.json 的路径
   */
  async analyze(filePath: string) {
    const rawData = await fs.readFile(filePath, 'utf-8');
    const session = JSON.parse(rawData);

    // 1. 提取基础信息
    const userMessages = session.messages.filter((m: { type: string }) => m.type === 'user');
    const geminiMessages = session.messages.filter((m: { type: string }) => m.type === 'gemini');
    
    // 2. 获取初始提问 (用于教练分析)
    const firstPrompt = userMessages[0]?.content?.[0]?.text || "";

    // 3. 提取工具链 (用于模式识别)
    const toolChain = geminiMessages.flatMap((m: { toolCalls?: { name: string }[] }) => 
      (m.toolCalls || []).map((tc) => tc.name)
    );

    // 4. 识别纠错行为 (检测用户的不满或修正习惯)
    const correctionCount = userMessages.filter((m: { content?: { text: string }[] }) => 
      /不对|理解错了|不是这个|重新|报错了/.test(m.content?.[0]?.text || "")
    ).length;

    // 5. 组装分析结果
    const firstGeminiMsg = geminiMessages[0] as { model?: string } | undefined;
    return {
      sessionId: session.sessionId,
      modelId: firstGeminiMsg?.model || "unknown",
      category: this.detectCategory(firstPrompt, toolChain),
      quality: {
        clarityScore: correctionCount > 0 ? 60 : 100,
        suggestedImprovement: this.generateSuggestion(firstPrompt)
      },
      efficiency: {
        totalTurns: session.messages.length,
        toolTrace: toolChain,
        isRepetitive: false // 需对比历史轨迹
      }
    };
  }

  private detectCategory(prompt: string, tools: string[]): string {
    if (tools.includes('replace')) return 'Coding';
    if (/解释|学习|如何/.test(prompt)) return 'Learning';
    return 'General';
  }

  private generateSuggestion(prompt: string): string {
    // 简易逻辑：如果指令太短，建议增加上下文
    if (prompt.length < 10) return "指令过于简短，建议补充具体的文件背景或预期目标。";
    return "保持良好，尝试加入更多的约束条件以获得更精准的响应。";
  }
}
