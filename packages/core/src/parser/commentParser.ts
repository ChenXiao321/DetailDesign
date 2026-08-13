import { HeaderComment, ParamDoc } from '../model/types.js';

/**
 * 解析 G-Pulse 风格函数头注释块：
 * /*******************************************************************
 * ** Function Name    : Gp_Xxx_Func
 * ** Service ID       : None
 * ** Sync/Async       : Synchronous
 * ** Reentrancy       : Non_Reentrancy
 * ** Parameter[in]    : uint8 Id_u8 - description
 * ** Parameter[inout] : None
 * ** Parameter[out]   : None
 * ** Return Value     : void
 * ** Description      : text...
 * continuation lines without field prefix belong to previous field
 * ********************************************************************
 */
export function parseHeaderComment(block: string): HeaderComment | null {
  const lines = block.split(/\r?\n/);
  const result: HeaderComment = {
    paramsIn: [],
    paramsInout: [],
    paramsOut: [],
  };

  type FieldKey = 'functionName' | 'serviceId' | 'syncAsync' | 'reentrancy'
    | 'paramsIn' | 'paramsInout' | 'paramsOut' | 'returnValue' | 'description';

  const fieldMap: Record<string, FieldKey> = {
    'function name': 'functionName',
    'service id': 'serviceId',
    'sync/async': 'syncAsync',
    'reentrancy': 'reentrancy',
    'parameter[in]': 'paramsIn',
    'parameter[inout]': 'paramsInout',
    'parameter[out]': 'paramsOut',
    'return value': 'returnValue',
    'description': 'description',
  };

  // 匹配 "** Field Name   : value"；字段名可含空格、/、[]
  const fieldRe = /^\s*\*\*?\s*([A-Za-z][A-Za-z /]*(?:\[(?:in|out|inout)\])?)\s*:\s*(.*)$/i;

  let currentField: FieldKey | null = null;

  for (const line of lines) {
    // 跳过分隔线 /****.../ 和 /****...****/
    if (/^\s*\/\*+\s*$/.test(line) || /^\s*\*+\/\s*$/.test(line)) continue;

    const m = line.match(fieldRe);
    if (m) {
      const key = fieldMap[m[1].trim().toLowerCase()];
      if (!key) continue;   // 未知字段忽略
      currentField = key;
      const value = m[2].trim();
      assignField(result, key, value);
    } else if (currentField) {
      // 续行：去掉行首的 "**" 或 "*" 前缀
      const cont = line.replace(/^\s*\*\*?\s?/, '').trim();
      if (cont === '') continue;
      appendField(result, currentField, cont);
    }
  }

  if (!result.functionName && !result.description) return null;
  return result;
}

function assignField(r: HeaderComment, key: string, value: string): void {
  switch (key) {
    case 'paramsIn':
    case 'paramsInout':
    case 'paramsOut':
      if (!/^none$/i.test(value)) r[key].push(parseParamDoc(value));
      break;
    case 'functionName': r.functionName = value; break;
    case 'serviceId': r.serviceId = value; break;
    case 'syncAsync': r.syncAsync = value; break;
    case 'reentrancy': r.reentrancy = value; break;
    case 'returnValue': r.returnValue = value; break;
    case 'description': r.description = value; break;
  }
}

function appendField(r: HeaderComment, key: string, cont: string): void {
  switch (key) {
    case 'paramsIn':
    case 'paramsInout':
    case 'paramsOut':
      // 参数续行视为新参数条目
      if (!/^none$/i.test(cont)) r[key].push(parseParamDoc(cont));
      break;
    case 'description':
      r.description = (r.description ? r.description + '\n' : '') + cont;
      break;
    case 'returnValue':
      r.returnValue = (r.returnValue ?? '') + ' ' + cont;
      break;
    default:
      break;
  }
}

/** "uint8 OsStatus_u8 - OS status" → { type, name, description } */
function parseParamDoc(raw: string): ParamDoc {
  const doc: ParamDoc = { raw };
  const dashIdx = raw.indexOf(' - ');
  const declPart = dashIdx >= 0 ? raw.slice(0, dashIdx).trim() : raw.trim();
  if (dashIdx >= 0) doc.description = raw.slice(dashIdx + 3).trim();

  // 取最后一个标识符作为变量名（处理指针*紧贴变量名的情况）
  const tokens = declPart.split(/\s+/);
  if (tokens.length > 0) {
    let last = tokens[tokens.length - 1];
    let ptrPrefix = '';
    while (last.startsWith('*')) { ptrPrefix += '*'; last = last.slice(1); }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(last)) {
      doc.name = last;
      doc.type = tokens.slice(0, -1).join(' ') + (ptrPrefix ? ' ' + ptrPrefix : '');
    }
  }
  return doc;
}
