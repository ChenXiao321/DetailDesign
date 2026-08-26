/***********************************************************************************************************************
**--------------------------------------------------------------------------------------------------------------------**
** Copyright (c) 2022 by G-Pulse.       All rights reserved.
** This software is copyright protected and proprietary to G-Pulse.
** G-Pulse grants to you only those rights as set out in the license conditions.
** All other rights remain with G-Pulse.
**--------------------------------------------------------------------------------------------------------------------**
**
* Administrative Information
* $Namespace_: ..\ Gp_TLF35584$
* $Class_____: C$
* $Name______: Gp_TLF35584_Cfg.c$
* $ArVeri____: 5$
* $FcVeri____: 0.2$
* $Author____: guowanchao$
*
* $Configuration or generate Date,Time: 13:39 2022/8/12 $
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: Yes
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_TLF35584 driver CFG file
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_TLF35584_Cfg.h"

/***********************************************************************************************************************
**                                      Static Local Variables Definition                                             **
***********************************************************************************************************************/
#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_START
#include "Gp_TLF35584_MemMap.h"

#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_STOP
#include "Gp_TLF35584_MemMap.h"

/***********************************************************************************************************************
**                                         Global Variables Definition                                                **
***********************************************************************************************************************/
#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_START
#include "Gp_TLF35584_MemMap.h"

/*init register runtime value*/
const uint8 Gp_TLF35584_idxRtRegValue_cau8[GP_TLF35584_INIT_REG_NUM] =
{
    GP_TLF35584_REG_DEVCFG0_VALUE,
    GP_TLF35584_REG_DEVCFG2_VALUE,
    GP_TLF35584_REG_SYSPCFG0_VALUE,
    GP_TLF35584_REG_SYSPCFG1_VALUE,
    GP_TLF35584_REG_WDCFG0_VALUE,
    GP_TLF35584_REG_WDCFG1_VALUE,
    GP_TLF35584_REG_FWDCFG_VALUE,
    GP_TLF35584_REG_WWDCFG0_VALUE,
    GP_TLF35584_REG_WWDCFG1_VALUE,
    GP_TLF35584_REG_DEVCTRL_VALUE,
    GP_TLF35584_REG_DEVCTRLN_VALUE,
    GP_TLF35584_REG_BCK_FREQ_CHANGE_VAULE,
    GP_TLF35584_REG_BCK_FRE_SPREAD_VAULE,
    GP_TLF35584_REG_BCK_MAIN_CTRL_VAULE,
    GP_TLF35584_REG_WKTIM0_VALUE,
    GP_TLF35584_REG_WKTIM1_VALUE,
    GP_TLF35584_REG_WKTIM2_VALUE,
};

#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_STOP
#include "Gp_TLF35584_MemMap.h"
/***********************************************************************************************************************
* $ArchiVer History:$
V1:
Date:23.11.2021 WBH
Description:Architecture Initial Version
realize Init, MainFunction,interface in single core application.

V2:
Date:10.04.2022 WBH
Description:Architecture second Version
new feature for new architecture application,
increase up to one data sections and one const data section for one cores,
increase new signal interface: DevSigDiag.

V3:
Date:10.09.2022 WBH
Description:Architecture third Version
new form for signal and interface, one signal can contain several interface.
delete V2 signal interface(GetDevMode and SetDevMod), instead of GetDevSigModeIn and SetDevSigModeOut interface.
delete calibration data section.

V4:
Date:24.03.2023 WBH
Description:Architecture fourth Version
added the system exception read interface:Gp_TLF35584_GetSystemUnusualReason
***********************************************************************************************************************/

/***********************************************************************************************************************
* $FcVer History:$
1.0.0: 2018-08-18
initial code version for V1 architecture.
realize init, MainFunction,service watchdog,errpin cfg etc
support IFX PMIC system basic chip TLF35584
2.0.0: 2021-08-01
new feature for G4 platform application,like change function interface etc
3.0.1: 2022-09-01
new feature for G4.1 platform application
initial code version for V3 architecture.
realize Init, MainFunction, SetDevSigModeOut, GetDevSigModeIn interface in multi-core application.
this FC version read IFX PMIC system basic chip TLF35584 fault signal periodically in MainFunction,
check diagnostic data periodically in MainFunction and output diagnostic data through the corresponding interface.
check the TLF35584 the actual and expected chip status
4.0.0:
2023-03-24
added the fault recovery function,added the mode repair function,added reset trigger function,added reset source
read function
2023-06-06
added Gp_TLF35584_CalloutWdgmValid interface,verify that the wdgm signal is valid.
4.0.1:
2024-01-09
err pin bist add Gp_TLF35584_GetResetType function call and loacl variable ErrpinStatus_u8 definition
4.0.2:
2024-04-16
1 add Gp_TLF35584_SetWkUpTimer function
2 optimization FWD dog service strategy,to solve interfere problem
5.0.0
2024-04-25
due to get error and set error are Async,it may cause error still exist but error variable already cleared.
so we update code list below to solve this problem:
1 delete Gp_TLF35584_CalloutWdgmValid interface
2 add Gp_TLF35584_SetWdgTriggerCondition interface to cooperate with WDGIF module
3 delete zero ErrRecord_au32 at Gp_TLF35584_GetDevSigDiag
4 add zero ErrRecord_au32 at Gp_TLF35584_GetAllFaultRegister
5 add call disable/enable interrupt at Gp_TLF35584_GetAllFaultRegister
6 add interface disable/enable interrupt at callout.c
5.0.1
2024-09-12
extern Gp_TLF35584_adrDataRec_vcau32 variable to adtapt integrate change
5.0.2
2025-04-03
1 modify analog BIST to fix BIST fail when wake up form standby mode with QST disable
2 Add fault debounce time  and  fault in row  max time record
3 Init function do not switch to normal,user should call set mode function after init to switch to normal
4 preinit and get unusually reason function called depending on whether bist called
***********************************************************************************************************************/


