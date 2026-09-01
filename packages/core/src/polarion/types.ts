/**
 * Polarion 同步层类型定义。
 * 本期路线：离线生成 Word round-trip 导入文件（docx + manifest csv）+ 导入后 ID 回写；
 * REST 直连仅留配置与 client 骨架。
 */
import type { PolarionMarker, FunctionUnit, ExternalInterface } from '../model/types.js';

/** Polarion 连接与导入配置（baseUrl/projectId/token 本期仅 push 骨架使用） */
export interface PolarionConfig {
  baseUrl: string;              // 如 https://polarion.example.com/polarion
  projectId: string;            // Polarion 项目 ID
  token: string;                // 访问令牌（REST 用）
  /** 5.2.2.2 表格类工作项标题模板，占位 {group} {name}（analyzer 侧同组标题重复，这里去重） */
  tableTitleTemplate: string;   // 默认 '{group} 接口函数：{name}'
  /** workItemKind → Polarion 工作项类型建议值（导入向导类型映射参考，写进 manifest 与说明） */
  workItemTypes: Record<string, string>;
  /** 工作项内嵌图片限宽 px（与 svg2png.py 的 700px 一致） */
  maxImageWidthPx: number;      // 默认 700
}

export const DEFAULT_POLARION_CONFIG: PolarionConfig = {
  baseUrl: '',
  projectId: '',
  token: '',
  tableTitleTemplate: '{group} 接口函数：{name}',
  workItemTypes: {
    function: 'Function',
    diagram: 'Diagram',
    statemachine: 'StateMachine',
    sequence: 'Sequence',
    table: 'Table',
  },
  maxImageWidthPx: 700,
};

/** 工作项实体引用：既供 workItemDoc 渲染卡片，也供 matchIds 回写 polarion.workItemId */
export type WorkItemEntity =
  | { type: 'function'; fn: FunctionUnit }
  | { type: 'callout'; ext: ExternalInterface; secNo: string }
  | { type: 'external-table'; ext: ExternalInterface }
  | { type: 'diagram'; holder: { polarion: PolarionMarker } };

/** 收集后的工作项草稿（collectWorkItems 输出，export / map-ids / push 共用） */
export interface WorkItemDraft {
  /** 稳定锚点：module::chapter::name（callGraphs 的 name 加 `callgraph:` 前缀防与函数名冲突） */
  key: string;
  chapter: string;              // 模板章节号，如 "5.2.3.2"
  kind: PolarionMarker['workItemKind'];
  /** H2 显示标题（5.2.2.2 已经模板去重） */
  title: string;
  /** 实体名（函数名 / 图名 / 场景名） */
  name: string;
  module: string;
  /** 源码位置（函数 "file:L1-L2"），无则 '-' */
  location: string;
  /** bodyHash（漂移提示），无则 '-' */
  hash: string;
  /** mermaid 图源码；无图工作项（5.2.2.2 表格、Callout）为 null */
  mermaidSrc: string | null;
  /** 图片文件名（相对 polarion/ 目录，如 figs/01_Gp_IoMcuAdc_Init.png）；无图为 null */
  figureFile: string | null;
  /** 回写后的 Polarion ID（manifest 闭环展示用） */
  workItemId: string | null;
  entity: WorkItemEntity;
}

/** 取工作项实体上的 PolarionMarker（回写入口） */
export function markerOf(draft: WorkItemDraft): PolarionMarker {
  const e = draft.entity;
  switch (e.type) {
    case 'function': return e.fn.polarion;
    case 'callout':
    case 'external-table': return e.ext.polarion;
    case 'diagram': return e.holder.polarion;
  }
}
