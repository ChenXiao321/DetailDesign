/* fixture: IoM 式 3 值初始化状态（GetCoreId 仅作数组索引，不得分角色图） */
#include "m_iom.h"

void Gp_Iom_Init(void)
{
    uint32 core;
    core = Gp_Iom_GetCoreId();
    if (Gp_Iom_HwInit(core) == E_OK)
    {
        Data_pt->InitStu_t = GP_IOM_INITSTU_INITED;
    }
    else
    {
        Data_pt->InitStu_t = GP_IOM_INITSTU_INIT_FAILED;
    }
}
