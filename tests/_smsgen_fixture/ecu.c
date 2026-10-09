/* fixture: EcuStp 式双核阶段状态机（角色分支 + 自旋等待 + 提前终止） */
#include "m_ecu.h"

void Gp_Ecu_Startup(void)
{
    uint32 CoreId_u32;
    CoreId_u32 = Gp_Ecu_GetCoreId();
    if (CoreId_u32 == GP_ECU_CORE0_ID)
    {
        /*master set stage one*/
        Mst_ptst->StpStage_t = GP_ECU_STPSTAGE_ONE;
        CalloutInitStageOneCore0();
        /*master set stage two*/
        Mst_ptst->StpStage_t = GP_ECU_STPSTAGE_TWO;
    }
    else
    {
        CalloutInitStageOneSat();
        while (Sat_ptst->StpStage_t != GP_ECU_STPSTAGE_TWO)
        {
            Gp_Ecu_NOP();
        }
    }
    Gp_TstApp_PreRunInit();
    if (Mst_ptst->TryPwrShdn_b == TRUE)
    {
        CalloutPwrShdnInStpPhase();
    }
    else
    {
        /*master set stage three（有守护：应保持表达式原文，注释不顶上去）*/
        Mst_ptst->StpStage_t = GP_ECU_STPSTAGE_THREE;
    }
}
