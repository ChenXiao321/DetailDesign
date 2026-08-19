export { analyzeModule, type InputFile } from './analyzer/moduleAnalyzer.js';
export { parseHeaderComment } from './parser/commentParser.js';
export { parseCFile, preprocessSource, walkTopLevel, nodeText } from './parser/cParser.js';
export { generateDesign, type GenerateOptions } from './generator/designGenerator.js';
export { generateHtmlReport } from './report/htmlReport.js';
export {
  OpenAICompatibleProvider, MockProvider, resolveConfig, normalizeBaseUrl,
  type LLMProvider, type LLMConfig,
} from './llm/provider.js';
export {
  buildFunctionDescriptionPrompt, buildStateMachinePrompt, buildSequencePrompt,
} from './llm/prompts.js';
export type * from './model/types.js';
