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
* $Name______: Gp_EcuStpShdn_Cfg.h$
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
** Gp_EcuStpShdn driver CFG header file
***********************************************************************************************************************/
#ifndef GP_ECUSTPSHDN_CFG_H_
#define GP_ECUSTPSHDN_CFG_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Std_Types.h"
/*other FC header file inclusion if necessary*/
#include "McalLib.h"
#include "Gp_TstApp.h"
#include "Gp_RstM.h"

/***********************************************************************************************************************
**                                      Macro Definition                                                              **
***********************************************************************************************************************/

/*define active core number*/
#define GP_ECUSTPSHDN_ACTIVE_CORE_NUM   (2U)

/*define NOP*/
#define GP_ECUSTPSHDN_NOP()                             MCAL_NOP()

/*safety enable*/
#define GP_ECUSTPSHDN_SAFETY_ENABLE     (STD_ON)

/*this configuration is effective when GP_ECUSTPSHDN_SAFETY_ENABLE is STD_ON*/
/*safety action enable*/
#if (GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)
#define GP_ECUSTPSHDN_SAFETY_ACTION_ENABLE      (STD_ON)
#endif  /*(GP_ECUSTPSHDN_SAFETY_ENABLE == STD_ON)*/

#endif /* GP_ECUSTPSHDN_CFG_H_ */

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