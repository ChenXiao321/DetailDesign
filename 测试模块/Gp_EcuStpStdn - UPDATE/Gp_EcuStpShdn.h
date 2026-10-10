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
* $Name______: Gp_EcuStpShdn.h$
* $ArchiVer__: 1$
* $FcVeri____: 1.0$
* $Author____: hexiangyu$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_EcuStpShdn driver header file
***********************************************************************************************************************/
#ifndef GP_ECUSTPSHDN_H_
#define GP_ECUSTPSHDN_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_EcuStpShdn_CfgData.h"

/***********************************************************************************************************************
**                                      Global Variables With Declaration                                             **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Global Function Prototypes                                                    **
***********************************************************************************************************************/
#define GP_ECUSTPSHDN_CODE_START
#include "Gp_EcuStpShdn_MemMap.h"


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
extern  void    Gp_EcuStpShdn_SetSafeState(void);

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
extern  void    Gp_EcuStpShdn_SetTryPwrShdn(void);

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
extern  boolean Gp_EcuStpShdn_GetSafeState(void);

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
extern  void    Gp_EcuStpShdn_TrapRecov(uint8 OsStatus_u8);

/***********************************************************************************************************************
** Function Name    : Gp_EcuStpShdn_OsErrRecov
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 OsStatus_u8 - OS status
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_EcuStpShdn OS error recovery.
***********************************************************************************************************************/
extern  void    Gp_EcuStpShdn_OsErrRecov(uint8 OsStatus_u8);

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
extern  void    Gp_EcuStpShdn_PwrShdnInShdnPhase(void);

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
extern  void    Gp_EcuStpShdn_Startup(void);

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
extern  void    Gp_EcuStpShdn_Mainfunction(void);

#define GP_ECUSTPSHDN_CODE_STOP
#include "Gp_EcuStpShdn_MemMap.h"



#endif /* GP_ECUSTPSHDN_H_ */

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