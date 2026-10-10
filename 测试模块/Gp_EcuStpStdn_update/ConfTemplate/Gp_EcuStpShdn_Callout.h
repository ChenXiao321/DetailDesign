/***********************************************************************************************************************
**--------------------------------------------------------------------------------------------------------------------**
** Copyright (c)  2022 by G-Pulse.      All rights reserved.
** This software is copyright protected and proprietary to G-Pulse.
** G-Pulse grants to you only those rights as set out in the license conditions.
** All other rights remain with G-Pulse.
**--------------------------------------------------------------------------------------------------------------------**
**
* Administrative Information
* $Namespace_: ..\ Gp_EcuStpShdn$
* $Class_____: C$
* $Name______: Gp_EcuStpShdn_Callout.h$
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
** Gp_EcuStpShdn driver callout header file
***********************************************************************************************************************/
#ifndef GP_ECUSTPSHDN_CALLOUT_H_
#define GP_ECUSTPSHDN_CALLOUT_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_EcuStpShdn_Types.h"

/***********************************************************************************************************************
**                                      Global Function Prototypes                                                    **
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
extern  uint32  Gp_EcuStpShdn_CalloutGetCoreId(void);

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_CalloutGetSysTimeMs
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : uint32 - core ID
** Description      : get system time million second callout function.
***********************************************************************************************************************/
extern  uint32  Gp_EcuStpShdn_CalloutGetSysTimeMs(void);

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
extern  void    Gp_EcuStpShdn_CalloutInitStageOneCore0(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);

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
extern  void    Gp_EcuStpShdn_CalloutInitStageTwoCore0(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);

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
extern  void    Gp_EcuStpShdn_CalloutInitStageTwoCore1(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);
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
extern  void    Gp_EcuStpShdn_CalloutInitStageTwoCore2(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);
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
extern  void    Gp_EcuStpShdn_CalloutInitStageTwoCore3(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);
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
extern  void    Gp_EcuStpShdn_CalloutInitStageTwoCore4(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);
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
extern  void    Gp_EcuStpShdn_CalloutInitStageTwoCore5(volatile Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);
#endif  /*(GP_ECUSTPSHDN_ACTIVE_CORE_NUM > 5U)*/

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
extern  void    Gp_EcuStpShdn_CalloutPwrShdnInStpPhase(void);

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
extern  void    Gp_EcuStpShdn_CalloutTrapRecov(uint8 OsStatus_u8);

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
extern  void    Gp_EcuStpShdn_CalloutOsErrRecov(uint8 OsStatus_u8);

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
extern  void    Gp_EcuStpShdn_CalloutPwrShdnInShdnPhase(void);

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
extern  void    Gp_EcuStpShdn_CalloutSafeState(void);

#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
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
extern  void    Gp_EcuStpShdn_CalloutInitFailedHnd(uint32 InitRslt_u32);

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
extern  boolean Gp_EcuStpShdn_CalloutChkMcuPreRunTest(void);

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
extern  void    Gp_EcuStpShdn_CalloutMcuPreRunTestFailedHnd(void);

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
extern  boolean Gp_EcuStpShdn_CalloutChkSwtToRun(void);

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
extern  void    Gp_EcuStpShdn_CalloutSwtToRunFailedHnd(void);

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
extern  boolean Gp_EcuStpShdn_CalloutChkMcuRunTimeTest(void);

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
extern  void    Gp_EcuStpShdn_CalloutMcuRunTimeTestFailedHnd(void);

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
extern  boolean Gp_EcuStpShdn_CalloutChkSbcTest(void);

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
extern  void    Gp_EcuStpShdn_CalloutSbcTestFailedHnd(void);

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
***********************************************************************************************************************/extern  void    Gp_EcuStpShdn_CalloutSbcInitInSafeState(uint32* SbcInfo_pu32);
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
extern  void    Gp_EcuStpShdn_CalloutSbcInit(uint32* SbcInfo_pu32);

#define GP_ECUSTPSHDN_CODE_STOP
#include "Gp_EcuStpShdn_MemMap.h"



#endif /* GP_ECUSTPSHDN_CALLOUT_H_ */

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