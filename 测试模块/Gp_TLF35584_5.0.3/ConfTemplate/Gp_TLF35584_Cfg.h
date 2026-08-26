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
* $FcVeri____: 0.2$
* $Author____: guowanchao$
*
* $Configuration or generate Date,Time: 13:39 . 2022/8/12 $
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: Yes
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_TLF35584 driver CFG header file
***********************************************************************************************************************/
#ifndef GP_TLF35584_CFG_H_
#define GP_TLF35584_CFG_H_
/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_TLF35584_Reg.h"
#include "Gp_TLF35584_Types.h"
/*other FC header file inclusion if necessary*/
#include "Smu.h"

/***********************************************************************************************************************
**                                            Macro Definition                                                        **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                                  system configuration                                              **
***********************************************************************************************************************/
#define GP_TLF35584_DEM_ERROR_ENABLE            (GP_TLF35584_ENABLE)
#define GP_TLF35584_DRIVER_USED_FOR             (GP_TLF35584_USED_FOR_APP)
#define GP_TLF35584_WD_MODE                     (GP_TLF35584_FWD_WWD_SPI)
#define GP_TLF35584_WDGM_ENABLE                 (GP_TLF35584_DISABLE)

/*built in self-test configuration*/
#define GP_TLF35584_SMU_CONFIG_ENABLE           (GP_TLF35584_ENABLE)
#define GP_TLF35584_ANA_BIST_ENABLE             (GP_TLF35584_ENABLE)
#define GP_TLF35584_FWD_BIST_ENABLE             (GP_TLF35584_ENABLE)
#define GP_TLF35584_WWD_BIST_ENABLE             (GP_TLF35584_ENABLE)
#define GP_TLF35584_ERR_BIST_ENABLE             (GP_TLF35584_ENABLE)

/*bist mask bit,should adjust according to LDO Enabled*/
#define GP_TLF35584_MONSF1_MASK                 ((uint8)0x23U)
#define GP_TLF35584_MONSF2_MASK                 ((uint8)0x02U)
#define GP_TLF35584_MONSF3_MASK                 ((uint8)0xC1U)
/*select which LDO to do bist,should adjust according to LDO Enabled*/
#define GP_TLF35584_COMPARETOR_OV               ((uint8)0x23U)
#define GP_TLF35584_COMPARETOR_UV               ((uint8)0x02U)
#define GP_TLF35584_COMPARETOR_IN               ((uint8)0xC1U)
/***********************************************************************************************************************
**                                                  window watch dog configuration                                    **
***********************************************************************************************************************/
#define GP_TLF35584_WWD_EN                      (GP_TLF35584_DISABLE)
#define GP_TLF35584_WWD_OPEN_WINDOW             (GP_TLF35584_WWD_CW_TIME_20MS)
#define GP_TLF35584_WWD_CLOSED_WINDOW           (GP_TLF35584_WWD_OW_TIME_20MS)
#define GP_TLF35584_WWD_SEVICE_SELECT           (GP_TLF35584_WWD_SEVICE_SPI)
/*error threshold:  (1~15)*/
#define GP_TLF35584_WWD_ERR_THRE                ((uint8)0x07U)

/***********************************************************************************************************************
**                                                  function watch dog configuration                                  **
***********************************************************************************************************************/
#define GP_TLF35584_FWD_EN                      (GP_TLF35584_ENABLE)
#define GP_TLF35584_FWD_WINDOW                  (GP_TLF35584_FWD_WINDOW_40MS)
/*error threshold:  (1~15)*/
#define GP_TLF35584_FWD_ERR_THRE                ((uint8)0x07U)

/***********************************************************************************************************************
**                                                  fsp configuration                                                 **
***********************************************************************************************************************/
#define GP_TLF35584_FSP_EN                      (GP_TLF35584_ENABLE)

/***********************************************************************************************************************
**                                                  power configuration                                               **
***********************************************************************************************************************/
#define GP_TLF35584_POWER_LDO_STDBY             (GP_TLF35584_DISABLE)
#define GP_TLF35584_POWER_LDO_VREF              (GP_TLF35584_ENABLE)
#define GP_TLF35584_POWER_LDO_COM               (GP_TLF35584_ENABLE)
#define GP_TLF35584_POWER_LDO_QT1               (GP_TLF35584_ENABLE)
#define GP_TLF35584_POWER_LDO_QT2               (GP_TLF35584_ENABLE)
#define GP_TLF35584_EMC_FRE_CHANGE              (GP_TLF35584_EMC_FRE_6_PERCENT)

/***********************************************************************************************************************
**                                                  robust configuration                                              **
***********************************************************************************************************************/
/*number of initialization attempts*/
#define GP_TLF35584_TRY_REINIT_MAX                  ((uint8)3U)
/*number of mode and fault repair attempts*/
#define GP_TLF35584_TRY_REPAIR_MAX                  ((uint8)3U)

/*mode switch delay time*/
#define GP_TLF35584_MODE_SWITCH_DELAY               ((uint32)300U)

/*service wdg time and mainfuction should > 1*/
#define GP_TLF35584_SERVICE_WDG_TIME                ((uint8)3U)

/*wake-up confirm*/
#define GP_TLF35584_WAKE_UP_SOURCE_CONFIRM          (GP_TLF35584_DISABLE)
/*ss1/ss2 confirm*/
#define GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM          (GP_TLF35584_ENABLE)

/*WWD enable for wwd bist*/
#define GP_TLF35584_WWD_BIST_DELAY_ENABLE           (GP_TLF35584_DISABLE)
#if(GP_TLF35584_WWD_BIST_DELAY_ENABLE == STD_ON)
#define GP_TLF35584_WWD_BIST_DELAY_TIME             ((uint32)5000U)
#endif
#define GP_TLF35584_DEBUG_SUPPORT_ENABLE            (GP_TLF35584_ENABLE)

/*configuration not required*/
/***********************************************************************************************************************
**                                                  DEVCFG0--00                                                       **
***********************************************************************************************************************/
#define GP_TLF35584_REG_DEVCFG0_VALUE           ((GP_TLF35584_DEVCFG0_WKTIMEN << 7U) |\
                                                (GP_TLF35584_DEVCFG0_WKTIMCYC << 6U) |\
                                                (GP_TLF35584_DEVCFG0_TRDEL))

#define GP_TLF35584_DEVCFG0_WKTIMEN             ((uint8)0x00U)
#define GP_TLF35584_DEVCFG0_WKTIMCYC            ((uint8)0x01U)
#define GP_TLF35584_DEVCFG0_TRDEL               ((uint8)0x08U)

/***********************************************************************************************************************
**                                                  DEVCFG1--01                                                       **
***********************************************************************************************************************/
/*TLF35584 reset delay cfg*/
#define GP_TLF35584_REG_DEVCFG1_VALUE           ((GP_TLF35584_DEVCFG1_RESDEL))
#define GP_TLF35584_DEVCFG1_RESDEL              ((uint8)0x07U)

/***********************************************************************************************************************
**                                                  DEVCFG2--02                                                       **
***********************************************************************************************************************/
/*TLF35584 sleep current cfg*/
#define GP_TLF35584_REG_DEVCFG2_VALUE           ((GP_TLF35584_DEVCFG2_CMONEN << 4U) |\
                                                (GP_TLF35584_DEVCFG2_CTHR << 2U) |\
                                                (GP_TLF35584_DEVCFG2_ESYNPHA << 1U)|\
                                                (GP_TLF35584_DEVCFG2_ESYNEN << 0U))

#define GP_TLF35584_DEVCFG2_CMONEN              ((uint8)0x00U)
#define GP_TLF35584_DEVCFG2_CTHR                ((uint8)0x00U)
#define GP_TLF35584_DEVCFG2_ESYNPHA             ((uint8)0x00U)
#define GP_TLF35584_DEVCFG2_ESYNEN              ((uint8)0x00U)

/***********************************************************************************************************************
**                                                  SYSPCFG0--04                                                      **
***********************************************************************************************************************/
/*TLF35584 standby regulator cfg*/
#define GP_TLF35584_REG_SYSPCFG0_VALUE          ((GP_TLF35584_POWER_LDO_STDBY))

/***********************************************************************************************************************
**                                                  SYSPCFG1--05                                                      **
***********************************************************************************************************************/
/*TLF35584 err pin cfg*/
#define GP_TLF35584_REG_SYSPCFG1_VALUE          ((GP_TLF35584_REG_SYSPCFG1_SS2DEL << 5U) |\
                                                (GP_TLF35584_REG_SYSPCFG1_ERRSLPEN << 4U) |\
                                                (GP_TLF35584_FSP_EN << 3U)|\
                                                (GP_TLF35584_REG_SYSPCFG1_ERRRECEN << 2U)|\
                                                (GP_TLF35584_REG_SYSPCFG1_ERRREC << 0U))

#define GP_TLF35584_REG_SYSPCFG1_SS2DEL         ((uint8)0x00U)
#define GP_TLF35584_REG_SYSPCFG1_ERRSLPEN       ((uint8)0x00U)
#define GP_TLF35584_REG_SYSPCFG1_ERRRECEN       ((uint8)0x01U)
#define GP_TLF35584_REG_SYSPCFG1_ERRREC         ((uint8)0x00U)

/***********************************************************************************************************************
**                                                  WDCFG0--06                                                        **
***********************************************************************************************************************/
/*TLF35584 wdg cfg*/
#define GP_TLF35584_REG_WDCFG0_VALUE            ((GP_TLF35584_WWD_ERR_THRE << 4U) |\
                                                (GP_TLF35584_WWD_EN << 3U) |\
                                                (GP_TLF35584_FWD_EN << 2U)|\
                                                (GP_TLF35584_WWD_SEVICE_SELECT << 1U)|\
                                                (GP_TLF35584_WD_TB_0_1_MS << 0U))

/***********************************************************************************************************************
**                                                  WDCFG1--07                                                        **
***********************************************************************************************************************/
/*TLF35584 fwd cfg err threshold*/
#define GP_TLF35584_REG_WDCFG1_VALUE            ((0x0U << 4U) |(GP_TLF35584_FWD_ERR_THRE << 0U))


/***********************************************************************************************************************
**                                                  FWDCFG--08                                                        **
***********************************************************************************************************************/
/*TLF35584 wwd cfg err threshold*/
#define GP_TLF35584_REG_FWDCFG_VALUE            (GP_TLF35584_FWD_WINDOW << 0U)

/***********************************************************************************************************************
**                                                  WWDCFG0--09                                                       **
***********************************************************************************************************************/
/*TLF35584 wwd closed window cfg */
#define GP_TLF35584_REG_WWDCFG0_VALUE           (GP_TLF35584_WWD_CLOSED_WINDOW << 0U)

/***********************************************************************************************************************
**                                                  WWDCFG1--0A                                                       **
***********************************************************************************************************************/
/*TLF35584 wwd opend window cfg */
#define GP_TLF35584_REG_WWDCFG1_VALUE           (GP_TLF35584_WWD_OPEN_WINDOW << 0U)

/***********************************************************************************************************************
**                                                  WKTIM0--12                                                        **
***********************************************************************************************************************/
#define  GP_TLF35584_REG_WKTIM0_VALUE           ((uint8)0x00U)

/***********************************************************************************************************************
**                                                  WKTIM1--13                                                        **
***********************************************************************************************************************/
#define  GP_TLF35584_REG_WKTIM1_VALUE           ((uint8)0x00U)

/***********************************************************************************************************************
**                                                  WKTIM2--14                                                        **
***********************************************************************************************************************/
#define  GP_TLF35584_REG_WKTIM2_VALUE           ((uint8)0x00U)

/***********************************************************************************************************************
**                                                  DEVCTRL--15                                                       **
***********************************************************************************************************************/
#define  GP_TLF35584_REG_DEVCTRL_VALUE          ((GP_TLF35584_POWER_LDO_QT2 << 7U) |\
                                                (GP_TLF35584_POWER_LDO_QT1 << 6U) |\
                                                (GP_TLF35584_POWER_LDO_COM << 5U) |\
                                                (GP_TLF35584_POWER_LDO_COM << 3U) |\
                                                (GP_TLF35584_NORMAL_STATE << 0U))

/***********************************************************************************************************************
**                                                  DEVCTRL--16                                                       **
***********************************************************************************************************************/
#define  GP_TLF35584_REG_DEVCTRLN_VALUE         ((uint8)(GP_TLF35584_REG_DEVCTRL_VALUE ^ (uint8)0xFFU))

/***********************************************************************************************************************
**                                                  BCK_FREQ_CHANGE--31                                               **
***********************************************************************************************************************/
/*TLF35584 EMC buck fre cfg*/
#define GP_TLF35584_REG_BCK_FREQ_CHANGE_VAULE   (GP_TLF35584_REG_BCK_FREQ_CHANGE_SEL << 0U)
#define GP_TLF35584_REG_BCK_FREQ_CHANGE_SEL     ((uint8)0x00U)

/***********************************************************************************************************************
**                                                  BCK_FRE_SPREAD--32                                                **
***********************************************************************************************************************/
#define GP_TLF35584_REG_BCK_FRE_SPREAD_VAULE    (GP_TLF35584_EMC_FRE_CHANGE << 0U)

/***********************************************************************************************************************
**                                                  BCK_MAIN_CTRL--33                                                 **
***********************************************************************************************************************/
#define GP_TLF35584_REG_BCK_MAIN_CTRL_VAULE     (GP_TLF35584_REG_BCK_MAIN_CTRL_VALID << 6U)
#define GP_TLF35584_REG_BCK_MAIN_CTRL_VALID     ((uint8)0x01U)
/***********************************************************************************************************************
**                                      Global Variables With Declaration                                             **
***********************************************************************************************************************/
#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_START
#include "Gp_TLF35584_MemMap.h"

extern  const uint8 Gp_TLF35584_idxRtRegValue_cau8[GP_TLF35584_INIT_REG_NUM];

#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_STOP
#include "Gp_TLF35584_MemMap.h"

#endif /* GP_TLF35584_CFG_H_ */
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


