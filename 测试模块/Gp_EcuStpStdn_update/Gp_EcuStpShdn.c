/***********************************************************************************************************************
**--------------------------------------------------------------------------------------------------------------------**
** Copyright (c) 2022 by G-Pulse.       All rights reserved.
** This software is copyright protected and proprietary to G-Pulse.
** G-Pulse grants to you only those rights as set out in the license conditions.
** All other rights remain with G-Pulse.
**--------------------------------------------------------------------------------------------------------------------**
**
* Administrative Information
* $Namespace_: ..\ Gp_EcuStpShdn$
* $Class_____: C$
* $Name______: Gp_EcuStpShdn.c$
* $ArchiVer__: 1$
* $FcVeri____: 1.0$
* $Author____: hexiangyu$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_EcuStpShdn driver source file
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_EcuStpShdn_Callout.h"
#include "Gp_EcuStpShdn.h"

/***********************************************************************************************************************
**                                      Macro Definition                                                              **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Typedef Definition                                                            **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Static Local Variables Definition                                             **
***********************************************************************************************************************/
/*$LV-B$*/
#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_GLOBAL_START
#include "Gp_EcuStpShdn_MemMap.h"
/*master local implement runtime buffer*/
GP_ECUSTPSHDN_STATIC_   volatile    Gp_EcuStpShdn_MstLocalImplType  Gp_EcuStpShdn_bufMstLocalImpl_ltst;

#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_GLOBAL_STOP
#include "Gp_EcuStpShdn_MemMap.h"

#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE0_START
#include "Gp_EcuStpShdn_MemMap.h"
/*satellite local implement runtime buffer core0*/
GP_ECUSTPSHDN_STATIC_   volatile    Gp_EcuStpShdn_SatLocalImplType  Gp_EcuStpShdn_bufSatLocalImplCore0_ltst;

#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE0_STOP
#include "Gp_EcuStpShdn_MemMap.h"

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)
#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE1_START
#include "Gp_EcuStpShdn_MemMap.h"
/*satellite local implement runtime buffer core1*/
GP_ECUSTPSHDN_STATIC_   volatile    Gp_EcuStpShdn_SatLocalImplType  Gp_EcuStpShdn_bufSatLocalImplCore1_ltst;

#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE1_STOP
#include "Gp_EcuStpShdn_MemMap.h"
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 2U)
#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE2_START
#include "Gp_EcuStpShdn_MemMap.h"
/*satellite local implement runtime buffer core2*/
GP_ECUSTPSHDN_STATIC_   volatile    Gp_EcuStpShdn_SatLocalImplType  Gp_EcuStpShdn_bufSatLocalImplCore2_ltst;

#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE2_STOP
#include "Gp_EcuStpShdn_MemMap.h"
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 2U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 3U)
#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE3_START
#include "Gp_EcuStpShdn_MemMap.h"
/*satellite local implement runtime buffer core3*/
GP_ECUSTPSHDN_STATIC_   volatile    Gp_EcuStpShdn_SatLocalImplType  Gp_EcuStpShdn_bufSatLocalImplCore3_ltst;

#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE3_STOP
#include "Gp_EcuStpShdn_MemMap.h"
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 3U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 4U)
#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE4_START
#include "Gp_EcuStpShdn_MemMap.h"
/*satellite local implement runtime buffer core4*/
GP_ECUSTPSHDN_STATIC_   volatile    Gp_EcuStpShdn_SatLocalImplType  Gp_EcuStpShdn_bufSatLocalImplCore4_ltst;

#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE4_STOP
#include "Gp_EcuStpShdn_MemMap.h"
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 4U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 5U)
#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE5_START
#include "Gp_EcuStpShdn_MemMap.h"
/*satellite local implement runtime buffer core5*/
GP_ECUSTPSHDN_STATIC_   volatile    Gp_EcuStpShdn_SatLocalImplType  Gp_EcuStpShdn_bufSatLocalImplCore5_ltst;

#define GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE5_STOP
#include "Gp_EcuStpShdn_MemMap.h"
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 5U)*/

#define GP_ECUSTPSHDN_CONST_FAR_DATA_ALIGN4_GLOBAL_START
#include "Gp_EcuStpShdn_MemMap.h"

/*FC runtime buffer address container for satellite local implement variables*/
GP_ECUSTPSHDN_STATIC_   const   Gp_EcuStpShdn_SatRunTimeType \
Gp_EcuStpShdn_rtSatCont_lcatst[GP_ECUSTPSHDN_CORE_NUM] =
{
        /*global constant runtime buffer address of core0*/
        {
                &Gp_EcuStpShdn_bufSatLocalImplCore0_ltst,
                Gp_EcuStpShdn_CalloutInitStageTwoCore0,
        },
        /*global constant runtime buffer address of core1*/
        {
#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)
                &Gp_EcuStpShdn_bufSatLocalImplCore1_ltst,
                Gp_EcuStpShdn_CalloutInitStageTwoCore1,
#else
                (Gp_EcuStpShdn_SatLocalImplType*)GP_ECUSTPSHDN_NULL_PTR,
                GP_ECUSTPSHDN_NULL_PTR,
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)*/
        },
        /*global constant runtime buffer address of core2*/
        {
#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 2U)
                &Gp_EcuStpShdn_bufSatLocalImplCore2_ltst,
                Gp_EcuStpShdn_CalloutInitStageTwoCore2,
#else
                (Gp_EcuStpShdn_SatLocalImplType*)GP_ECUSTPSHDN_NULL_PTR,
                GP_ECUSTPSHDN_NULL_PTR,
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 2U)*/
        },
        /*global constant runtime buffer address of core3*/
        {
#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 3U)
                &Gp_EcuStpShdn_bufSatLocalImplCore3_ltst,
                Gp_EcuStpShdn_CalloutInitStageTwoCore3,
#else
                (Gp_EcuStpShdn_SatLocalImplType*)GP_ECUSTPSHDN_NULL_PTR,
                GP_ECUSTPSHDN_NULL_PTR,
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 3U)*/
        },
        /*global constant runtime buffer address of core4*/
        {
#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 4U)
                &Gp_EcuStpShdn_bufSatLocalImplCore4_ltst,
                Gp_EcuStpShdn_CalloutInitStageTwoCore4,
#else
                (Gp_EcuStpShdn_SatLocalImplType*)GP_ECUSTPSHDN_NULL_PTR,
                GP_ECUSTPSHDN_NULL_PTR,
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 4U)*/
        },
        /*global constant runtime buffer address of core5*/
        {
#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 5U)
                &Gp_EcuStpShdn_bufSatLocalImplCore5_ltst,
                Gp_EcuStpShdn_CalloutInitStageTwoCore5,
#else
                (Gp_EcuStpShdn_SatLocalImplType*)GP_ECUSTPSHDN_NULL_PTR,
                GP_ECUSTPSHDN_NULL_PTR,
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 5U)*/
        },
};

#define GP_ECUSTPSHDN_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
#include "Gp_EcuStpShdn_MemMap.h"
/*$LV-E$*/
/***********************************************************************************************************************
**                                      Static Local Function Declaration                                             **
***********************************************************************************************************************/
#define GP_ECUSTPSHDN_CODE_START
#include "Gp_EcuStpShdn_MemMap.h"

#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
GP_ECUSTPSHDN_STATIC_   void    Gp_EcuStpShdn_CheckInitRslt(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);
GP_ECUSTPSHDN_STATIC_   void    Gp_EcuStpShdn_MstProcMcuPreRunTest(void);
GP_ECUSTPSHDN_STATIC_   void    Gp_EcuStpShdn_MstPostInit(void);
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/

GP_ECUSTPSHDN_STATIC_   uint32  Gp_EcuStpShdn_GetLastSatTimeStamp(void);

#define GP_ECUSTPSHDN_CODE_STOP
#include "Gp_EcuStpShdn_MemMap.h"

/***********************************************************************************************************************
**                                      Function Source Code                                                          **
***********************************************************************************************************************/
#define GP_ECUSTPSHDN_CODE_START
#include "Gp_EcuStpShdn_MemMap.h"

#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CheckInitRslt
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst - pointer to satellite local implement
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn check initialization result
***********************************************************************************************************************/
GP_ECUSTPSHDN_STATIC_   void    Gp_EcuStpShdn_CheckInitRslt(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst)
{
    uint32  Cnt_u32 = 0U;

    for (Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_ECUSTPSHDN_INIT_RSLT_REC_NUM; Cnt_u32++)
    {
        if (Impl_ptst->InitCheckRslt_t[Cnt_u32] == E_NOT_OK)
        {
            /*recored initialization failed in all result according to bit field*/
            Impl_ptst->InitRsltAllBits_u32 |= (uint32)((uint32)1U << Cnt_u32);
        }
        else
        {
            /*do nothing*/
        }
    }
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_MstProcMcuPreRunTest
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn master process MCU PreRunTest
***********************************************************************************************************************/
GP_ECUSTPSHDN_STATIC_   void    Gp_EcuStpShdn_MstProcMcuPreRunTest(void)
{
    volatile    Gp_EcuStpShdn_MstLocalImplType* MstImpl_ptst = &Gp_EcuStpShdn_bufMstLocalImpl_ltst;

    /*check if MCU PreRunTest is failed*/
    if (Gp_EcuStpShdn_CalloutChkMcuPreRunTest() == FALSE)
    {
        MstImpl_ptst->McuSelfTest_t = GP_ECUSTPSHDN_SELFTEST_FAIL;
#if (GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)
        Gp_EcuStpShdn_CalloutMcuPreRunTestFailedHnd();
#endif  /*(GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)*/
    }
    else
    {
        MstImpl_ptst->McuSelfTest_t = GP_ECUSTPSHDN_SELFTEST_PASS;
    }
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_MstPostInit
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn master post initialization
***********************************************************************************************************************/
GP_ECUSTPSHDN_STATIC_   void    Gp_EcuStpShdn_MstPostInit(void)
{
    volatile    Gp_EcuStpShdn_MstLocalImplType* MstImpl_ptst = &Gp_EcuStpShdn_bufMstLocalImpl_ltst;
    volatile    Gp_EcuStpShdn_SatLocalImplType* SatImpl_ptst = &Gp_EcuStpShdn_bufSatLocalImplCore0_ltst;

    /*check initialization result*/
    Gp_EcuStpShdn_CheckInitRslt(SatImpl_ptst);
    if (SatImpl_ptst->InitRsltAllBits_u32 != 0U)
    {
#if (GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)
        Gp_EcuStpShdn_CalloutInitFailedHnd(SatImpl_ptst->InitRsltAllBits_u32);
#endif  /*(GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)*/
    }
    else
    {
        /*do nothing*/
    }
    Gp_TstApp_SwitchToRunPhase();
    /*check if switch to run phase is failed*/
    if (Gp_EcuStpShdn_CalloutChkSwtToRun() == FALSE)
    {
#if (GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)
        Gp_EcuStpShdn_CalloutSwtToRunFailedHnd();
#endif  /*(GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)*/
    }
    else
    {
        /*do nothing*/
    }
    /*check SBC self test result*/
    if (Gp_EcuStpShdn_CalloutChkSbcTest() == FALSE)
    {
        MstImpl_ptst->SbcSelfTest_t = GP_ECUSTPSHDN_SELFTEST_FAIL;
#if (GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)
        Gp_EcuStpShdn_CalloutSbcTestFailedHnd();
#endif  /*(GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)*/
    }
    else
    {
        MstImpl_ptst->SbcSelfTest_t = GP_ECUSTPSHDN_SELFTEST_PASS;
    }
}
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_GetLastSatTimeStamp
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : uint32 - maximum time stamp
** Description      : Gp_EcuStpShdn get last satellite time stamp
***********************************************************************************************************************/
GP_ECUSTPSHDN_STATIC_   uint32  Gp_EcuStpShdn_GetLastSatTimeStamp(void)
{
    uint32  TimeStamp_u32[GP_ECUSTPSHDN_ACTIVE_CORE_NUM];
    uint32  Cnt_u32 = 0U;
    uint32  MaxTimeStamp_u32 = 0U;

    /*master core time stamp is not record in satellite local implement buffer*/
    TimeStamp_u32[0U] = 0U;
#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)
    TimeStamp_u32[1U] = Gp_EcuStpShdn_bufSatLocalImplCore1_ltst.TimeStamp_u32;
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 2U)
    TimeStamp_u32[2U] = Gp_EcuStpShdn_bufSatLocalImplCore2_ltst.TimeStamp_u32;
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 3U)
    TimeStamp_u32[3U] = Gp_EcuStpShdn_bufSatLocalImplCore3_ltst.TimeStamp_u32;
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 4U)
    TimeStamp_u32[4U] = Gp_EcuStpShdn_bufSatLocalImplCore4_ltst.TimeStamp_u32;
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 5U)
    TimeStamp_u32[5U] = Gp_EcuStpShdn_bufSatLocalImplCore5_ltst.TimeStamp_u32;
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)*/

    /*get maximum satellite time stamp*/
    for (Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_ECUSTPSHDN_ACTIVE_CORE_NUM; Cnt_u32++)
    {
        if (MaxTimeStamp_u32 < TimeStamp_u32[Cnt_u32])
        {
            MaxTimeStamp_u32 = TimeStamp_u32[Cnt_u32];
        }
        else
        {
            /*do nothing*/
        }
    }

    return (MaxTimeStamp_u32);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_SetSafeState
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn set safe state.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_SetSafeState(void)
{
    Gp_EcuStpShdn_bufMstLocalImpl_ltst.SafeState_b = TRUE;
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_SetTryPwrShdn
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn set try power shutdown.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_SetTryPwrShdn(void)
{
    Gp_EcuStpShdn_bufMstLocalImpl_ltst.TryPwrShdn_b = TRUE;
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_GetSafeState
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : boolean - TRUE/FASLE
** Description      : Gp_EcuStpShdn get safe state.
***********************************************************************************************************************/
boolean Gp_EcuStpShdn_GetSafeState(void)
{
    boolean SafeState_b = FALSE;

    SafeState_b = Gp_EcuStpShdn_bufMstLocalImpl_ltst.SafeState_b;

    return (SafeState_b);
}
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_TrapRecov
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 OsStatus_u8 - OS status
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn trap recovery.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_TrapRecov(uint8 OsStatus_u8)
{
    Gp_EcuStpShdn_CalloutTrapRecov(OsStatus_u8);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_OsErrRecov1
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 OsStatus_u8 - OS status
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn OS error recovery.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_OsErrRecov1(uint8 OsStatus_u8)
{
    /* 测试更改*/
    Gp_EcuStpShdn_CalloutOsErrRecov1(OsStatus_u8);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_PwrShdnInShdnPhase
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn power shut down in shutdown phase.
this function will invoke callout function in shut down phase.
this function should be invoke by core0 only.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_PwrShdnInShdnPhase(void)
{
    Gp_EcuStpShdn_CalloutPwrShdnInShdnPhase();
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_Startup
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn startup.
this function will realize multi-core timing controlling. invoke microcontroller PreRun test function
and check test result, and process test failed situation. get reset information from Gp_RstM,
check safe state flag and try power shutdown flag, the program will enter the corresponding state if the flag is set,
else, the program will invoke MCAL initialization function and check initialization result,
and process initialization failed situation. invoke SBC self test function and check test result,
and process test failed situation. this function will record several system time of startup key point for observing.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_Startup(void)
{
    const   Gp_EcuStpShdn_SatRunTimeType*   Rt_cptst = &Gp_EcuStpShdn_rtSatCont_lcatst[0U];
    volatile    Gp_EcuStpShdn_MstLocalImplType* MstImpl_ptst = &Gp_EcuStpShdn_bufMstLocalImpl_ltst;
    volatile    Gp_EcuStpShdn_SatLocalImplType* SatImpl_ptst = &Gp_EcuStpShdn_bufSatLocalImplCore0_ltst;
    uint32  CoreId_u32 = 0U;
    uint32  Cnt_u32 = 0U;
    uint32  SbcInfo_u32 = 0U;
    uint8   RstTypePlt_u8 = 0U;
    uint8   RstTypeMcal_u8 = 0U;
    uint8   RstId_u8 = 0U;
    uint8   RstCoreId_u8 = 0U;

    /*get core ID*/
    CoreId_u32 = Gp_EcuStpShdn_CalloutGetCoreId();
    /*get satellite runtime buffer address of current core to local address*/
    Rt_cptst = &Gp_EcuStpShdn_rtSatCont_lcatst[CoreId_u32];
    SatImpl_ptst = Rt_cptst->Impl_ptst;

    /********
    stage one
    ********/
    /*
    ECU is init stage one.
    master will complete necessary initialization
    which will increase performance of subsequent process.
    satellite will stay.
    */
    if (CoreId_u32 == GP_ECUSTPSHDN_CORE0_ID)
    {
        /*set initialization value for other driver init result*/
        SatImpl_ptst->InitRsltAllBits_u32 = 0U;
        for (Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_ECUSTPSHDN_INIT_RSLT_REC_NUM; Cnt_u32++)
        {
            SatImpl_ptst->InitCheckRslt_t[Cnt_u32] = E_OK;
        }

        /*set initialization value*/
        for (Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_ECUSTPSHDN_MST_TIME_STAMP_NUM; Cnt_u32++)
        {
            MstImpl_ptst->TimeStamp_u32[Cnt_u32] = 0U;
        }

        MstImpl_ptst->McuPreTestRslt_u32 = 0U;
        MstImpl_ptst->McuRunTestRslt_u32 = 0U;
        MstImpl_ptst->SbcInfo_u32 = 0U;
        MstImpl_ptst->StpStage_t = GP_ECUSTPSHDN_STPSTAGE_ONE;
        MstImpl_ptst->McuSelfTest_t = GP_ECUSTPSHDN_SELFTEST_UNDEF;
        MstImpl_ptst->SbcSelfTest_t = GP_ECUSTPSHDN_SELFTEST_UNDEF;

        MstImpl_ptst->RstTypePlt_u8 = 0U;
        MstImpl_ptst->RstTypeMcal_u8 = 0U;
        MstImpl_ptst->RstId_u8 = 0U;
        MstImpl_ptst->RstCoreId_u8 = 0U;

        MstImpl_ptst->SafeState_b = FALSE;
        MstImpl_ptst->TryPwrShdn_b = FALSE;

        SatImpl_ptst->TimeStamp_u32 = 0U;

        Gp_EcuStpShdn_CalloutInitStageOneCore0(SatImpl_ptst);

#if (GP_RSTM_PROJ_TYPE_SEL == GP_RSTM_PROJ_TYPE_APP_NO_BOOT)
        Gp_RstM_InitOne();
#endif  /*(GP_RSTM_PROJ_TYPE_SEL == GP_RSTM_PROJ_TYPE_APP_NO_BOOT)*/
        /*master set ECU is init stage two*/
        MstImpl_ptst->StpStage_t = GP_ECUSTPSHDN_STPSTAGE_TWO;
    }
    else
    {
        /*set initialization value for other driver init result*/
        SatImpl_ptst->InitRsltAllBits_u32 = 0U;
        for (Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_ECUSTPSHDN_INIT_RSLT_REC_NUM; Cnt_u32++)
        {
            SatImpl_ptst->InitCheckRslt_t[Cnt_u32] = E_OK;
        }

        /*set initialization value*/
        SatImpl_ptst->TimeStamp_u32 = 0U;
        /*satellite is waiting for init stage two*/
        while (MstImpl_ptst->StpStage_t != GP_ECUSTPSHDN_STPSTAGE_TWO)
        {
            GP_ECUSTPSHDN_NOP();
        }
    }

    /********
    stage two
    ********/
    /*
    ECU is init stage two.
    all cores perform SafeTpack init and pre_run phase test, if safety is enable.
    and then master will invoke RstM init and get reset reason.
    master will check try power down flag and enter safe state flag, perform corresponding program.
    master will check MCU pre-run test and SBC test result, perform corresponding program.
    satellite will stay.
    */

#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
    Gp_TstApp_PreRunInit();
    Gp_TstApp_PreRunPhase();
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/
    /*record PreRunTest completion time stamp*/
    MstImpl_ptst->TimeStamp_u32[GP_ECUSTPSHDN_MST_TIME_STAMP_PRERUN] = Gp_EcuStpShdn_CalloutGetSysTimeMs();

    if (CoreId_u32 == GP_ECUSTPSHDN_CORE0_ID)
    {
#if (GP_RSTM_PROJ_TYPE_SEL == GP_RSTM_PROJ_TYPE_APP_NO_BOOT)
        Gp_RstM_InitTwo();
#else
        Gp_RstM_Init();
#endif  /*(GP_RSTM_PROJ_TYPE_SEL == GP_RSTM_PROJ_TYPE_APP_NO_BOOT)*/
        Gp_RstM_GetLastRstTypeInfo
        (
            &RstTypePlt_u8,
            &RstTypeMcal_u8,
            &RstId_u8,
            &RstCoreId_u8
        );
        MstImpl_ptst->RstTypePlt_u8 = RstTypePlt_u8;
        MstImpl_ptst->RstTypeMcal_u8 = RstTypeMcal_u8;
        MstImpl_ptst->RstId_u8 = RstId_u8;
        MstImpl_ptst->RstCoreId_u8 = RstCoreId_u8;
#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
#if (GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)
        /*check if Gp_RstM set try power down flag*/
        if (MstImpl_ptst->TryPwrShdn_b == TRUE)
        {
            Gp_EcuStpShdn_CalloutPwrShdnInStpPhase();
            /*program will not run to here*/
        }
        else
        {
            /*check if Gp_RstM set enter safe state flag*/
            if (MstImpl_ptst->SafeState_b == TRUE)
            {
                /*core0 init*/
                Rt_cptst->StpStageTwo_pf(SatImpl_ptst);
                Gp_EcuStpShdn_CalloutSbcInitInSafeState(&SbcInfo_u32);
                MstImpl_ptst->SbcInfo_u32 = SbcInfo_u32;
                Gp_EcuStpShdn_CalloutSafeState();
            }
            else
#endif  /*(GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)*/
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/
            {
#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
                Gp_EcuStpShdn_MstProcMcuPreRunTest();
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/
                /*core0 init*/
                Rt_cptst->StpStageTwo_pf(SatImpl_ptst);
                /*record master initialization completion time stamp*/
                MstImpl_ptst->TimeStamp_u32[GP_ECUSTPSHDN_MST_TIME_STAMP_MST_INIT] = \
                    Gp_EcuStpShdn_CalloutGetSysTimeMs();
#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
                Gp_EcuStpShdn_MstPostInit();
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/
                Gp_EcuStpShdn_CalloutSbcInit(&SbcInfo_u32);
                MstImpl_ptst->SbcInfo_u32 = SbcInfo_u32;
                /*record master post initialization completion time stamp*/
                MstImpl_ptst->TimeStamp_u32[GP_ECUSTPSHDN_MST_TIME_STAMP_MST_POST_INIT] = \
                    Gp_EcuStpShdn_CalloutGetSysTimeMs();
            }
            /*master set ECU is init stage three*/
            MstImpl_ptst->StpStage_t = GP_ECUSTPSHDN_STPSTAGE_THREE;
#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
#if (GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)
        }
#endif  /*(GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)*/
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/
    }
    else
    {
        /*satellite is waiting for init stage three*/
        while (MstImpl_ptst->StpStage_t != GP_ECUSTPSHDN_STPSTAGE_THREE)
        {
            GP_ECUSTPSHDN_NOP();
        }
    }

    /**********
    stage three
    **********/
    /*
    ECU is init stage three.
    satellite will complete initialization
    */
    if (CoreId_u32 == GP_ECUSTPSHDN_CORE0_ID)
    {
        /*do nothing*/
    }
    else
    {
        Rt_cptst->StpStageTwo_pf(SatImpl_ptst);
        /*record satellite initialization completion time stamp*/
        SatImpl_ptst->TimeStamp_u32 = Gp_EcuStpShdn_CalloutGetSysTimeMs();
#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
        /*program will check initialization result when it is not safe state*/
        if (MstImpl_ptst->SafeState_b == FALSE)
        {
            /*check initialization result*/
            Gp_EcuStpShdn_CheckInitRslt(SatImpl_ptst);
            if (SatImpl_ptst->InitRsltAllBits_u32 != 0U)
            {
#if (GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)
                Gp_EcuStpShdn_CalloutInitFailedHnd(SatImpl_ptst->InitRsltAllBits_u32);
#endif  /*(GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)*/
            }
            else
            {
                /*do nothing*/
            }
        }
        else
        {
            /*do nothing*/
        }
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/
    }
}
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_Mainfunction
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn main function.
this function will invoke MCU Runtime test, and check the test result, and process test failed situation
if program is not in safe state or try power shutdown state.
this function will calculate the last satellite time stamp by the master core.
this function should be invoke by the cores which need perform MCU runtime test.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_Mainfunction(void)
{
    volatile    Gp_EcuStpShdn_MstLocalImplType* MstImpl_ptst = &Gp_EcuStpShdn_bufMstLocalImpl_ltst;
    uint32  CoreId_u32 = 0U;

    /*get core ID*/
    CoreId_u32 = Gp_EcuStpShdn_CalloutGetCoreId();

    if (CoreId_u32 == GP_ECUSTPSHDN_CORE0_ID)
    {
        /*get last satellite initialization time stamp, it will be get only once by core0*/
        if (MstImpl_ptst->TimeStamp_u32[GP_ECUSTPSHDN_MST_TIME_STAMP_LAST_SAT_INIT] == 0U)
        {
            MstImpl_ptst->TimeStamp_u32[GP_ECUSTPSHDN_MST_TIME_STAMP_LAST_SAT_INIT] = \
                Gp_EcuStpShdn_GetLastSatTimeStamp();
        }
        else
        {
            /* 测试新增 */
            MstImpl_ptst->TimeStamp_u32[GP_ECUSTPSHDN_MST_TIME_STAMP_LAST_SAT_INIT] = 0U
            /*do nothing*/
        }
    }
    else
    {
        /*do nothing*/
    }

#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
    if ((MstImpl_ptst->TryPwrShdn_b == FALSE) && (MstImpl_ptst->SafeState_b == FALSE))
    {
        /*perform MCU runtime test*/
        Gp_TstApp_RunTimePhase();
        /*
        ECU is runtime stage.
        master will check MCU runtime test result, and perform corresponding program.
        */
        if (CoreId_u32 == GP_ECUSTPSHDN_CORE0_ID)
        {
            /*check if switch to run phase is failed*/
            if (Gp_EcuStpShdn_CalloutChkMcuRunTimeTest() == FALSE)
            {
#if (GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)
                Gp_EcuStpShdn_CalloutMcuRunTimeTestFailedHnd();
#endif  /*(GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE == STD_ON)*/
            }
            else
            {
                /*do nothing*/
            }
        }
        else
        {
            /*do nothing*/
        }
    }
    else
    {
        /*do nothing*/
    }
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/
}


#define GP_ECUSTPSHDN_CODE_STOP
#include "Gp_EcuStpShdn_MemMap.h"

/***********************************************************************************************************************
* $ArchiVer History:$
V1:
initial version.
realize Startup, MainFunction, SetSafeState, SetTryPwrShdn, GetSafeState,
TrapRcove, OsErrRecov, PwrShdnInShdnPhase interface.
***********************************************************************************************************************/

/***********************************************************************************************************************
* $FcVer History:$
1.0.0:
initial code version for V1 architecture.
realize Startup, MainFunction, SetSafeState, SetTryPwrShdn, GetSafeState,
TrapRcove, OsErrRecov, PwrShdnInShdnPhase interface in multi-core application.
this FC realize initialization sequence and function of multi-core in EcuM DriverInitOne,
include perform MCU self test and SBC self test, and perform corresponding program if check result is failed.
this FC provide trap recovery and OS error recovery interface for system trap or OS error occurs,
integrator should complete recovery code in corresponding callout function.
this FC provide GetSafeState interface to ASW for entering safe state after multiple unexpected reset occurs.
this FC is depend on Gp_RstM and Gp_SafeTpack.
1.1.0:
optimize Startup and Mainfunction code, decrease cyclomatic complexity.
increase MCAL initialization check and failed action.
increase record master initialization time stamp function. 
***********************************************************************************************************************/
