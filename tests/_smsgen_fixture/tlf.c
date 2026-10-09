/* fixture: TLF35584 式宏族 + switch 驱动状态机（含 default 展开） */
#include "m_tlf.h"

void Gp_Tlf_PreInit(void)
{
    /*Init Memory*/
    Data_pst->StateVar_u8 = GP_TLF_INITIAL_TASK;
}

void Gp_Tlf_Init(void)
{
    /*wait for user to switch normal*/
    Data_pst->StateVar_u8 = GP_TLF_WAIT_STATE;
}

void Gp_Tlf_MainFunction(void)
{
    switch (Data_pst->StateVar_u8)
    {
        case GP_TLF_PREPARERUN_STATE:
            if (Dev_u8 == GP_TLF_NORMAL_STATE)
            {
                Data_pst->StateVar_u8 = GP_TLF_RUN_STATE;
            }
            else
            {
                Data_pst->StateVar_u8 = GP_TLF_ERROR_STATE;
            }
            break;
        case GP_TLF_RUN_STATE:
            Gp_Tlf_FeedWdg();
            break;
        default:
            Data_pst->StateVar_u8 = GP_TLF_PREPARERUN_STATE;
            break;
    }
}
