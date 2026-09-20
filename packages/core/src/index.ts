export { analyzeModule, type InputFile } from './analyzer/moduleAnalyzer.js';
export { parseHeaderComment } from './parser/commentParser.js';
export { parseCFile, preprocessSource, walkTopLevel, nodeText } from './parser/cParser.js';
export { generateDesign, flowchartProblems, type GenerateOptions } from './generator/designGenerator.js';
export { buildStaticFlowchart, buildFallbackFlowchart } from './generator/staticFlowchart.js';
export { generateHtmlReport } from './report/htmlReport.js';
export { parseAbbreviationsDocx, type AbbreviationsDoc } from './report/abbrDocx.js';
export { functionCard, calloutCard, esc, escRaw, paramRows } from './report/cards.js';
export { wrapFlowchartLabels, pinEndNodeToBottom } from './report/mermaidPre.js';
export { mermaidRenderScript } from './report/renderScript.js';
export {
  DEFAULT_POLARION_CONFIG, markerOf,
  type PolarionConfig, type WorkItemDraft, type WorkItemEntity,
} from './polarion/types.js';
export { resolvePolarionConfig } from './polarion/resolveConfig.js';
export { createPolarionClient, type PolarionClient } from './polarion/client.js';
export { collectWorkItems } from './polarion/collect.js';
export {
  parsePolarionCsv, matchWorkItemIds, applyWorkItemIds,
  type PolarionCsvRow, type MatchResult,
} from './polarion/matchIds.js';
export {
  renderWorkItemsDocument, renderManifestCsv, type WorkItemDocOptions,
} from './polarion/workItemDoc.js';
export {
  OpenAICompatibleProvider, MockProvider, resolveConfig, normalizeBaseUrl,
  type LLMProvider, type LLMConfig,
} from './llm/provider.js';
export {
  buildFunctionDescriptionPrompt, buildSequencePrompt,
} from './llm/prompts.js';
export { buildStaticStateMachine, parseSmTransitions } from './generator/staticStateMachine.js';
export type * from './model/types.js';
