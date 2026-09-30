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
  OpenAICompatibleProvider, MockProvider, resolveConfig, normalizeBaseUrl,
  type LLMProvider, type LLMConfig,
} from './llm/provider.js';
export {
  buildFunctionDescriptionPrompt,
} from './llm/prompts.js';
export { buildStaticStateMachine, parseSmTransitions, polishSmLabels } from './generator/staticStateMachine.js';
export { buildStaticSequence } from './generator/staticSequence.js';
export { buildDocumentContent, type AbbrTableInput } from './generator/staticDocument.js';
export {
  collectDiagrams, buildBatchPage, extractDiagramSvgs, svgNaturalSize, pickShotParams,
  wrapSvgShotPage, hasDiagramPng, applyDiagramPng, syncSmAliasPng, type DiagramEntry,
} from './report/imageBatch.js';
export {
  lintModelSchema, TOP_KEYS, DOC_KEYS, NOTES_KEYS, CONFIG_DETAIL_FIELDS,
  type SchemaLintOptions,
} from './model/schemaLint.js';
export type * from './model/types.js';
