/* fixture: deterministic sequence diagram generation (ASCII only) */
#include "m_seq.h"

void Gp_Seq_Startup(void)
{
    uint32 CoreId_u32;
    CoreId_u32 = Gp_Seq_GetCoreId();
    if (CoreId_u32 == GP_SEQ_CORE0_ID)
    {
        CalloutInitStageOneCore0();
#if (GP_SEQ_RSTM_SEL == 1U)
        Gp_RstM_InitOne();
#endif
    }
    else
    {
        while (Sat_ptst->StpStage_t != GP_SEQ_STPSTAGE_TWO)
        {
            Gp_Seq_NOP();
        }
    }
    Gp_TstApp_PreRunInit();
#if (GP_SEQ_SAFETY_ENABLE == 1U)
    if (Mst_ptst->TryPwrShdn_b == TRUE)
    {
        CalloutPwrShdnInStpPhase();
    }
    else if (Mst_ptst->SafeState_b == TRUE)
    {
        CalloutSafeState();
    }
    else
    {
        Gp_Seq_MstProc();
    }
#endif
#if (GP_SEQ_SAFETY_ENABLE == 1U)
    Gp_Seq_MstPost();
#endif
    CalloutSbcInit();
}

void Gp_Seq_MainFunction(void)
{
    uint32 CoreId_u32;
    CoreId_u32 = Gp_Seq_GetCoreId();
    if (CoreId_u32 == GP_SEQ_CORE0_ID)
    {
        if (Gp_Seq_CalloutChkRunTime() == FALSE)
        {
            CalloutRunTimeFailedHnd();
        }
        Gp_TstApp_RunTimePhase();
    }
    else
    {
        Gp_Seq_SatRunTimeProc();
    }
}

void Gp_Seq_IomInit(void)
{
    uint32 CoreId_u32;
    CoreId_u32 = Gp_Seq_GetCoreId();
    Gp_Seq_HwInit(CoreId_u32);
    if (Gp_Seq_HwCheck(CoreId_u32) == E_OK)
    {
        CalloutInitDone();
    }
}

void Gp_Seq_Interleaved(void)
{
#if (GP_SEQ_SAFETY_ENABLE == 1U)
    if (Mst_ptst->TryPwrShdn_b == TRUE)
    {
        CalloutPwrShdn();
    }
    else
#endif
    {
#if (GP_SEQ_SAFETY_ENABLE == 1U)
        Gp_Seq_MstProc();
#endif
        CalloutSbcInit();
    }
}

void Gp_Seq_RegionAlt(void)
{
#if (GP_SEQ_RSTM_SEL == 1U)
    Gp_RstM_InitTwo();
#else
    Gp_RstM_Init();
#endif
}
