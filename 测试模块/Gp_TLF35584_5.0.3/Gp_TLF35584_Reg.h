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
* $Name______: Gp_TLF35584_Cfg.h$
* $ArVeri____: 5$
* $FcVeri____: 0.3$
* $Author____: GWC$
*
* $Configuration or generate Date,Time: 13:39 . 2022/8/12 $
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_TLF35584 register header file
***********************************************************************************************************************/
#ifndef GP_TLF35584_REG_H_
#define GP_TLF35584_REG_H_
/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_TLF35584_Types.h"

/***********************************************************************************************************************
**                                            Macro Definition                                                        **
***********************************************************************************************************************/
/*register description*/
/*initialization register*/
#define GP_TLF35584_REG_DEVCFG0                 ((uint8)0x00U)
#define GP_TLF35584_REG_DEVCFG1                 ((uint8)0x01U)
#define GP_TLF35584_REG_DEVCFG2                 ((uint8)0x02U)
#define GP_TLF35584_REG_PROTCFG                 ((uint8)0x03U)
#define GP_TLF35584_REG_SYSPCFG0                ((uint8)0x04U)
#define GP_TLF35584_REG_SYSPCFG1                ((uint8)0x05U)
#define GP_TLF35584_REG_WDCFG0                  ((uint8)0x06U)
#define GP_TLF35584_REG_WDCFG1                  ((uint8)0x07U)
#define GP_TLF35584_REG_FWDCFG                  ((uint8)0x08U)
#define GP_TLF35584_REG_WWDCFG0                 ((uint8)0x09U)
#define GP_TLF35584_REG_WWDCFG1                 ((uint8)0x0AU)
/*status register��read only*/
#define GP_TLF35584_REG_RSYSPCFG0               ((uint8)0x0BU)
#define GP_TLF35584_REG_RSYSPCFG1               ((uint8)0x0CU)
#define GP_TLF35584_REG_RWDCFG0                 ((uint8)0x0DU)
#define GP_TLF35584_REG_RWDCFG1                 ((uint8)0x0EU)
#define GP_TLF35584_REG_RFWDCFG                 ((uint8)0x0FU)
#define GP_TLF35584_REG_RWWDCFG0                ((uint8)0x10U)
#define GP_TLF35584_REG_RWWDCFG1                ((uint8)0x11U)
/*wake-up timer register*/
#define GP_TLF35584_REG_WKTIMCFG0               ((uint8)0x12U)
#define GP_TLF35584_REG_WKTIMCFG1               ((uint8)0x13U)
#define GP_TLF35584_REG_WKTIMCFG2               ((uint8)0x14U)
/*initialization register*/
#define GP_TLF35584_REG_DEVCTRL                 ((uint8)0x15U)
#define GP_TLF35584_REG_DEVCTRLN                ((uint8)0x16U)
/*feed watchdog register*/
#define GP_TLF35584_REG_WWDSCMD                 ((uint8)0x17U)
#define GP_TLF35584_REG_FWDRSP                  ((uint8)0x18U)
#define GP_TLF35584_REG_FWDRSPSYNC              ((uint8)0x19U)
/*flag register��write 1 to clear*/
#define GP_TLF35584_REG_SYSFAIL                 ((uint8)0x1AU)
#define GP_TLF35584_REG_INITERR                 ((uint8)0x1BU)
#define GP_TLF35584_REG_IF                      ((uint8)0x1CU)
#define GP_TLF35584_REG_SYSSF                   ((uint8)0x1DU)
#define GP_TLF35584_REG_WKSF                    ((uint8)0x1EU)
#define GP_TLF35584_REG_SPISF                   ((uint8)0x1FU)
#define GP_TLF35584_REG_MONSF0                  ((uint8)0x20U)
#define GP_TLF35584_REG_MONSF1                  ((uint8)0x21U)
#define GP_TLF35584_REG_MONSF2                  ((uint8)0x22U)
#define GP_TLF35584_REG_MONSF3                  ((uint8)0x23U)
#define GP_TLF35584_REG_OTFAIL                  ((uint8)0x24U)
#define GP_TLF35584_REG_OTWRNSF                 ((uint8)0x25U)
/*status register��read only*/
#define GP_TLF35584_REG_VMONSTAT                ((uint8)0x26U)
#define GP_TLF35584_REG_DEVSTAT                 ((uint8)0x27U)
#define GP_TLF35584_REG_PROTSTAT                ((uint8)0x28U)
#define GP_TLF35584_REG_WWDSTAT                 ((uint8)0x29U)
#define GP_TLF35584_REG_FWDSTAT0                ((uint8)0x2AU)
#define GP_TLF35584_REG_FWDSTAT1                ((uint8)0x2BU)
/*bist register��for safety*/
#define GP_TLF35584_REG_ABIST_CTRL0             ((uint8)0x2CU)
#define GP_TLF35584_REG_ABIST_CTRL1             ((uint8)0x2DU)
#define GP_TLF35584_REG_ABIST_SELECT0           ((uint8)0x2EU)
#define GP_TLF35584_REG_ABIST_SELECT1           ((uint8)0x2FU)
#define GP_TLF35584_REG_ABIST_SELECT2           ((uint8)0x30U)
/*emc control register��for safety*/
#define GP_TLF35584_REG_BCK_FREQ_CHANGE         ((uint8)0x31U)
#define GP_TLF35584_REG_BCK_FRE_SPREAD          ((uint8)0x32U)
#define GP_TLF35584_REG_BCK_MAIN_CTRL           ((uint8)0x33U)
#define GP_TLF35584_REG_GTM                     ((uint8)0x3FU)



/***********************************************************************************************************************
**                                      Global Variables With Declaration                                             **
***********************************************************************************************************************/
#endif /*GP_TLF35584_REG_H_ */
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
5.0.3
2025-11-28
1 delete mainfuncrion reinit logic,now init function directly write user configure value
2 add some annotation
3 change configure value,default device mode is init and wdg is count at 1ms
***********************************************************************************************************************/


