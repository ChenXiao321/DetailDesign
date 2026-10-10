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
* $Name______: Gp_EcuStpShdn_Callout.c$
* $ArchiVer__: 1$
* $FcVeri____: 1.0$
* $Author____: hexiangyu$
*
* $Configuration or generate Date,Time: 19:35 . 2022/1/18 $
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: Yes
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_EcuStpShdn driver callout source file
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_EcuStpShdn_Callout.h"

/***********************************************************************************************************************
**                                      Macro Definition                                                              **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Typedef Definition                                                            **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Static Local Variables Definition                                             **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Static Local Function Declaration                                             **
***********************************************************************************************************************/
#define GP_ECUSTPSHDN_CODE_START
#include "Gp_EcuStpShdn_MemMap.h"

#define GP_ECUSTPSHDN_CODE_STOP
#include "Gp_EcuStpShdn_MemMap.h"

/***********************************************************************************************************************
**                                      Function Source Code                                                          **
***********************************************************************************************************************/
#define GP_ECUSTPSHDN_CODE_START
#include "Gp_EcuStpShdn_MemMap.h"

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutGetCoreId
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : uint32 - core ID
** Description      : get core ID callout function, the function should get core ID from lower driver,
and make sure of core ID is available(core ID is valid and is enabled in configuration and is used as index 0~5).
***********************************************************************************************************************/
uint32  Gp_EcuStpShdn_CalloutGetCoreId(void)
{
    uint32  CoreId_u32 = 0U;

    /*the get core ID callout function should make sure the core ID could be used as core index 0~5*/
    /*CoreId_u32 = (uint32)Mcal_GetCpuIndex();*/

    /*
    if program crashed when integration running, perhaps trap is happened because of a invalid core ID
    or a disabled core ID, the integrator should use the following code for check core ID validity.

    if (((GP_ECUSTPSHDN_CORE0_ENABLE == STD_ON) && (CoreId_u32 == GP_ECUSTPSHDN_CORE0_ID)) ||
            ((GP_ECUSTPSHDN_CORE1_ENABLE == STD_ON) && (CoreId_u32 == GP_ECUSTPSHDN_CORE1_ID)) ||
            ((GP_ECUSTPSHDN_CORE2_ENABLE == STD_ON) && (CoreId_u32 == GP_ECUSTPSHDN_CORE2_ID)) ||
            ((GP_ECUSTPSHDN_CORE3_ENABLE == STD_ON) && (CoreId_u32 == GP_ECUSTPSHDN_CORE3_ID)) ||
            ((GP_ECUSTPSHDN_CORE4_ENABLE == STD_ON) && (CoreId_u32 == GP_ECUSTPSHDN_CORE4_ID)) ||
            ((GP_ECUSTPSHDN_CORE5_ENABLE == STD_ON) && (CoreId_u32 == GP_ECUSTPSHDN_CORE5_ID)))
    {
        core ID is valid
    }
    else
    {
        core ID is invalid, program should not go on
        while (1);
    }
    */

    return (CoreId_u32);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutGetSysTimeMs
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : uint32 - system time million second
** Description      : get system time million second callout function.
***********************************************************************************************************************/
uint32  Gp_EcuStpShdn_CalloutGetSysTimeMs(void)
{
    uint32  SysTime_u32 = 0U;

    return (SysTime_u32);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutInitStageOneCore0
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst - pointer to satellite local implement
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for initialization stage one of core0.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutInitStageOneCore0(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst)
{
    /*MCU and clock initialization, and other necessary initialization.*/
    
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutInitStageTwoCore0
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst - pointer to satellite local implement
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for initialization stage two of core0.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutInitStageTwoCore0(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst)
{
    /*MCAL and other driver initialization of core0*/
    
}

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutInitStageTwoCore1
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst - pointer to satellite local implement
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for initialization stage two of core1.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutInitStageTwoCore1(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst)
{
    /*MCAL and other driver initialization of core1*/

}
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 1U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 2U)
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutInitStageTwoCore2
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst - pointer to satellite local implement
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for initialization stage two of core2.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutInitStageTwoCore2(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst)
{
    /*MCAL and other driver initialization of core2*/

}
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 2U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 3U)
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutInitStageTwoCore3
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst - pointer to satellite local implement
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for initialization stage two of core3.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutInitStageTwoCore3(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst)
{
    /*MCAL and other driver initialization of core3*/
    
}
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 3U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 4U)
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutInitStageTwoCore4
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst - pointer to satellite local implement
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for initialization stage two of core4.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutInitStageTwoCore4(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst)
{
    /*MCAL and other driver initialization of core4*/
    
}
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 4U)*/

#if (GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 5U)
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutInitStageTwoCore5
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst - pointer to satellite local implement
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for initialization stage two of core5.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutInitStageTwoCore5(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst)
{
    /*MCAL and other driver initialization of core5*/
    
}
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 5U)*/

#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutPwrShdnInStpPhase
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for power shut down in start up phase.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutPwrShdnInStpPhase(void)
{

}
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutTrapRecov
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 OsStatus_u8 - OS status
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for trap recovery.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutTrapRecov(uint8 OsStatus_u8)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutOsErrRecov
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 OsStatus_u8 - OS status
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for OS error recovery.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutOsErrRecov(uint8 OsStatus_u8)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutPwrShdnInShdnPhase
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for power shut down in shut down phase.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutPwrShdnInShdnPhase(void)
{

}

#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutSafeState
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for special handling of safe state.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutSafeState(void)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutInitFailedHnd
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint32 InitRslt_u32 - initialization result
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for handling of initialization failed.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutInitFailedHnd(uint32 InitRslt_u32)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutChkMcuPreRunTest
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for check MCU PreRunTest result.
***********************************************************************************************************************/
boolean Gp_EcuStpShdn_CalloutChkMcuPreRunTest(void)
{
    /*program return TRUE if there is no necessary to check MCU PreRunTest result*/
    boolean TestPass_b = TRUE;

    return (TestPass_b);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutMcuPreRunTestFailedHnd
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for handling of MCU PreRunTest failed.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutMcuPreRunTestFailedHnd(void)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutChkSwtToRun
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for check switch to run phase.
***********************************************************************************************************************/
boolean Gp_EcuStpShdn_CalloutChkSwtToRun(void)
{
    /*program return TRUE if there is no necessary to check switch to run phase*/
    boolean TestPass_b = TRUE;

    return (TestPass_b);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutSwtToRunFailedHnd
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for handling of switch to run phase failed.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutSwtToRunFailedHnd(void)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutChkMcuRunTimeTest
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for check MCU RunTimeTest result.
***********************************************************************************************************************/
boolean Gp_EcuStpShdn_CalloutChkMcuRunTimeTest(void)
{
    /*program return TRUE if there is no necessary to check MCU RunTimeTest result*/
    boolean TestPass_b = TRUE;

    return (TestPass_b);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutMcuRunTimeTestFailedHnd
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for handling of MCU RunTimeTest failed.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutMcuRunTimeTestFailedHnd(void)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutChkSbcTest
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for check SBC test result.
***********************************************************************************************************************/
boolean Gp_EcuStpShdn_CalloutChkSbcTest(void)
{
    /*program return TRUE if there is no necessary to check SBC test result*/
    boolean TestPass_b = TRUE;

    return (TestPass_b);
}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutSbcTestFailedHnd
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for handling of SBC test failed.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutSbcTestFailedHnd(void)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutSbcInitInSafeState
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : uint32* SbcInfo_pu32 - SBC information when system start up
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for SBC initialization in safe state.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutSbcInitInSafeState(uint32* SbcInfo_pu32)
{
    uint32  Tmp_u32 = 0U;

    *SbcInfo_pu32 = Tmp_u32;
}
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutSbcInit
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : uint32* SbcInfo_pu32 - SBC information when system start up
** Return Value     : None
** Description      : Gp_EcuStpShdn callout function for SBC initialization.
***********************************************************************************************************************/
void    Gp_EcuStpShdn_CalloutSbcInit(uint32* SbcInfo_pu32)
{
    uint32  Tmp_u32 = 0U;

    *SbcInfo_pu32 = Tmp_u32;
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