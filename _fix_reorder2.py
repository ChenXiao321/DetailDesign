# -*- coding: utf-8 -*-
import json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
p = '内网测试/Gp_TLF35584_qwen/lld_design.json'
d = json.load(open(p, encoding='utf-8'))
fns = {f['name']: f for f in d['providedFunctions']+d['internalFunctions']}

def patch(name, old, new, count=1):
    fc = fns[name]['generated']['flowchart']
    n = fc.count(old)
    assert n == count, f'{name}: expect {count} got {n}: {old[:60]!r}'
    fns[name]['generated']['flowchart'] = fc.replace(old, new)
    print(f'[OK] {name}')

# ① fig54 AllSafety: 去 BREAK_LOOP 节点，TIME_CHECK--是--> 直挂 RETURN_RET（提前声明出口）
patch('Gp_TLF35584_AllSafetyBistCheck',
      '        TIME_CHECK -- 是 --> BREAK_LOOP\n',
      '        TIME_CHECK -- 是 --> RETURN_RET(["结束"])\n')
patch('Gp_TLF35584_AllSafetyBistCheck',
      '        LOOP_COND -- 否 --> RETURN_RET(["结束"])\n        BREAK_LOOP --> RETURN_RET\n',
      '        LOOP_COND -- 否 --> RETURN_RET\n')

# ② fig23 TransmitData: DATA_MATCH 极性反转（不一致=是→置错），INC_IDX 改走否支
patch('Gp_TLF35584_TransmitData',
      '    DATA_MATCH{"TxBuf_au16[Index_u32] == RxBuf_au16[Index_u32] ?"}',
      '    DATA_MATCH{"TxBuf_au16[Index_u32] != RxBuf_au16[Index_u32] ?"}')
patch('Gp_TLF35584_TransmitData',
      '    DATA_MATCH -- 否 --> SET_FLAG_ERR\n'
      '    SET_FLAG_ERR --> BREAK_INNER\n'
      '    BREAK_INNER --> CHECK_FLAG\n'
      '    DATA_MATCH -- 是 --> INC_IDX\n',
      '    DATA_MATCH -- 是 --> SET_FLAG_ERR\n'
      '    SET_FLAG_ERR --> BREAK_INNER\n'
      '    BREAK_INNER --> CHECK_FLAG\n'
      '    DATA_MATCH -- 否 --> INC_IDX\n')

json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('written')
