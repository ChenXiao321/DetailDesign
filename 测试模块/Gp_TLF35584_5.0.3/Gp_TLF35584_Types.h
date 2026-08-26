/***********************************************************************************************************************
**--------------------------------------------------------------------------------------------------------------------**
** Copyright (c)  2022 by G-Pulse.      All rights reserved.
** This software is copyright protected and proprietary to G-Pulse.
** G-Pulse grants to you only those rights as set out in the license conditions.
** All other rights remain with G-Pulse.
**--------------------------------------------------------------------------------------------------------------------**
**
* Administrative Information
* $Namespace_: ..\ Gp_TLF35584$
* $Class_____: C$
* $Name______: Gp_TLF35584_Types.h$
* $ArVeri____: 5$
* $FcVeri____: 0.3$
* $Author____: GWC$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_TLF35584 driver types header file
***********************************************************************************************************************/
#ifndef GP_TLF35584_TYPES_H_
#define GP_TLF35584_TYPES_H_
/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Std_Types.h"
/***********************************************************************************************************************
**                                      Macro Definition                                                              **
***********************************************************************************************************************/
#define GP_TLF35584_UNUSED_PARAMETER(VariableName)  (void)(VariableName)
#define GP_TLF35584_NULL_PTR                            ((void *) 0)

#ifndef Gp_TLF35584_INLINE_
#if defined __TASKING__
#define Gp_TLF35584_INLINE_     static inline
#elif defined __HIGHTEC__
#define Gp_TLF35584_INLINE_     static inline __attribute__ ((always_inline))
#endif
#endif

#ifndef GP_TLF35584_STATIC_
#define GP_TLF35584_STATIC_     static
#endif

/*system definition*/
#define GP_TLF35584_SIGNAL_INVALID              ((uint8)0x00U)
#define GP_TLF35584_SIGNAL_VALID                ((uint8)0x01U)
#define GP_TLF35584_MPS_NORMALMODE              ((uint8)0x00U)
#define GP_TLF35584_MPS_TESTMODE                ((uint8)0x01U)
#define GP_TLF35584_FAILED                      ((uint8)0U)
#define GP_TLF35584_PASS                        ((uint8)1U)
#define GP_TLF35584_DISABLE                     (0U)
#define GP_TLF35584_ENABLE                      (1U)

/*window watch dog configuration*/
/*closed time*/
#define GP_TLF35584_WWD_CW_TIME_20MS            ((uint8)0x03U)
#define GP_TLF35584_WWD_CW_TIME_30MS            ((uint8)0x05U)
#define GP_TLF35584_WWD_CW_TIME_40MS            ((uint8)0x07U)
#define GP_TLF35584_WWD_CW_TIME_100MS           ((uint8)0x13U)
/*open time*/
#define GP_TLF35584_WWD_OW_TIME_20MS            ((uint8)0x03U)
#define GP_TLF35584_WWD_OW_TIME_30MS            ((uint8)0x05U)
#define GP_TLF35584_WWD_OW_TIME_40MS            ((uint8)0x07U)
#define GP_TLF35584_WWD_OW_TIME_100MS           ((uint8)0x13U)
/*service function*/
#define GP_TLF35584_WWD_SEVICE_WDI              ((uint8)0x00U)
#define GP_TLF35584_WWD_SEVICE_SPI              ((uint8)0x01U)
/*wdg time base select*/
#define GP_TLF35584_WD_TB_0_1_MS                ((uint8)0x00U)
#define GP_TLF35584_WD_TB_1_MS                  ((uint8)0x01U)

/*function watch dog configuration*/
#define GP_TLF35584_FWD_WINDOW_40MS             ((uint8)0x07U)
#define GP_TLF35584_FWD_WINDOW_60MS             ((uint8)0x0BU)
#define GP_TLF35584_FWD_WINDOW_80MS             ((uint8)0x0FU)
#define GP_TLF35584_FWD_WINDOW_160MS            ((uint8)0x1FU)

/*frequency change*/
#define GP_TLF35584_EMC_FRE_NO_CHANGE           ((uint8)0x00U)
#define GP_TLF35584_EMC_FRE_1_PERCENT           ((uint8)0x2BU)
#define GP_TLF35584_EMC_FRE_2_PERCENT           ((uint8)0x55U)
#define GP_TLF35584_EMC_FRE_3_PERCENT           ((uint8)0x80U)
#define GP_TLF35584_EMC_FRE_4_PERCENT           ((uint8)0xAAU)
#define GP_TLF35584_EMC_FRE_5_PERCENT           ((uint8)0xD5U)
#define GP_TLF35584_EMC_FRE_6_PERCENT           ((uint8)0xFFU)

/*wdg mode*/
#define GP_TLF35584_FWD_SPI                     ((uint8)0x00U)
#define GP_TLF35584_FWD_WWD_SPI                 ((uint8)0x01U)
#define GP_TLF35584_WWD_WDI                     ((uint8)0x02U)
#define GP_TLF35584_WWD_SPI                     ((uint8)0x03U)
#define GP_TLF35584_FWD_SPI_WWD_WDI             ((uint8)0x04U)
/*Dev State*/
#define GP_TLF35584_INIT_STATE                  ((uint8)0x01U)
#define GP_TLF35584_NORMAL_STATE                ((uint8)0x02U)
#define GP_TLF35584_STANDBY_STATE               ((uint8)0x03U)
#define GP_TLF35584_PORST_STATE                 ((uint8)0x04U)
#define GP_TLF35584_WAKE_STATE                  ((uint8)0x05U)

/*err trace*/
#define GP_TLF35584_NO_ERROR                    ((uint32)0x00000000U)
#define GP_TLF35584_SPI_ERR                     ((uint32)0x00000001U)
#define GP_TLF35584_POWN_OFF_ERR                ((uint32)0x00000002U)
#define GP_TLF35584_INIT_ERR                    ((uint32)0x00000004U)
#define GP_TLF35584_SYSTEM_ERR                  ((uint32)0x00000008U)
#define GP_TLF35584_WAKE_UP_SOURCE_ERR          ((uint32)0x00000010U)
#define GP_TLF35584_PROTECT_REG_ERR             ((uint32)0x00000020U)
#define GP_TLF35584_PORST_FAIL_ERROR            ((uint32)0x00000040U)

/*dem report*/
#define GP_TLF35584_SPI_FAULT                   ((uint8)0U)
#define GP_TLF35584_POWER_OFF_FAULT             ((uint8)1U)
#define GP_TLF35584_REINIT_FAULT                ((uint8)2U)
#define GP_TLF35584_SYSTEM_FAULT                ((uint8)3U)
#define GP_TLF35584_WAKE_UP_SOURCE_FAULT        ((uint8)4U)
#define GP_TLF35584_PROTECT_REG_FAULT           ((uint8)5U)
#define GP_TLF35584_PORST_MODE_FAULT            ((uint8)6U)

/*Fault signal ID*/
#define GP_TLF35584_CHIP_FAULT                  ((uint16)0U)
#define GP_TLF35584_TRACKER2_FAULT              ((uint16)1U)
#define GP_TLF35584_TRACKER1_FAULT              ((uint16)2U)
#define GP_TLF35584_VREF_FAULT                  ((uint16)3U)
#define GP_TLF35584_COM_FAULT                   ((uint16)4U)
#define GP_TLF35584_VCORE_FAULT                 ((uint16)5U)
#define GP_TLF35584_UC_FAULT                    ((uint16)6U)
#define GP_TLF35584_STANDBY_FAULT               ((uint16)7U)
#define GP_TLF35584_PREG_FAULT                  ((uint16)8U)
#define GP_TLF35584_SPILOGICAL_FAULT            ((uint16)9U)
#define GP_TLF35584_FAULT_SIGNAL_NUMS           ((uint16)10U)
/*task id*/
#define GP_TLF35584_PREPARERUN_STATE            ((uint8)1U)
#define GP_TLF35584_WAIT_STATE                  ((uint8)2U)
#define GP_TLF35584_RUN_STATE                   ((uint8)3U)
#define GP_TLF35584_ERROR_STATE                 ((uint8)4U)
#define GP_TLF35584_INITIAL_TASK                ((uint8)5U)
/*offset*/
#define GP_TLF35584_REGISTER_OFFSET_0           ((uint8)0U)
#define GP_TLF35584_REGISTER_OFFSET_1           ((uint8)1U)
#define GP_TLF35584_REGISTER_OFFSET_2           ((uint8)2U)
#define GP_TLF35584_REGISTER_OFFSET_3           ((uint8)3U)
#define GP_TLF35584_REGISTER_OFFSET_4           ((uint8)4U)
#define GP_TLF35584_REGISTER_OFFSET_5           ((uint8)5U)
#define GP_TLF35584_REGISTER_OFFSET_6           ((uint8)6U)
#define GP_TLF35584_REGISTER_OFFSET_7           ((uint8)7U)

/*FWD Trigger reset*/
#define GP_TLF35584_FWD_RESET_ACTION            ((uint8)0x00U)
/*WWD Trigger reset*/
#define GP_TLF35584_WWD_RESET_ACTION            ((uint8)0x01U)
/*SPI buffer max*/
#define GP_TLF35584_SPI_BUFFER_LENGTH           ((uint8)32U)
/*driver for boot*/
#define GP_TLF35584_USED_FOR_BOOT               (0U)
/*driver for APP*/
#define GP_TLF35584_USED_FOR_APP                (1U)

/*initialize register index*/
#define GP_TLF35584_INIT_REG_NUM                    ((uint8)17U)
#define GP_TLF35584_REG_DEVCFG0_INDEX               ((uint8)0U)
#define GP_TLF35584_REG_DEVCFG2_INDEX               ((uint8)1U)
#define GP_TLF35584_REG_SYSPCFG0_INDEX              ((uint8)2U)
#define GP_TLF35584_REG_SYSPCFG1_INDEX              ((uint8)3U)
#define GP_TLF35584_REG_WDCFG0_INDEX                ((uint8)4U)
#define GP_TLF35584_REG_WDCFG1_INDEX                ((uint8)5U)
#define GP_TLF35584_REG_FWDCFG_INDEX                ((uint8)6U)
#define GP_TLF35584_REG_WWDCFG0_INDEX               ((uint8)7U)
#define GP_TLF35584_REG_WWDCFG1_INDEX               ((uint8)8U)
#define GP_TLF35584_REG_DEVCTRL_INDEX               ((uint8)9U)
#define GP_TLF35584_REG_DEVCTRLN_INDEX              ((uint8)10U)
#define GP_TLF35584_REG_BCK_FREQ_CHANGE_INDEX       ((uint8)11U)
#define GP_TLF35584_REG_BCK_FRE_SPREAD_INDEX        ((uint8)12U)
#define GP_TLF35584_REG_BCK_MAIN_CTRL_INDEX         ((uint8)13U)
#define GP_TLF35584_REG_WKTIMCFG0_INDEX             ((uint8)14U)
#define GP_TLF35584_REG_WKTIMCFG1_INDEX             ((uint8)15U)
#define GP_TLF35584_REG_WKTIMCFG2_INDEX             ((uint8)16U)
/*status register index*/
#define GP_TLF35584_STATUS_REG_NUM                  ((uint8)14U)
#define GP_TLF35584_REG_VMONSTAT_INDEX              ((uint8)0U)
#define GP_TLF35584_REG_DEVSTAT_INDEX               ((uint8)1U)
#define GP_TLF35584_REG_PROTSTAT_INDEX              ((uint8)2U)
#define GP_TLF35584_REG_WWDSTAT_INDEX               ((uint8)3U)
#define GP_TLF35584_REG_FWDSTAT0_INDEX              ((uint8)4U)
#define GP_TLF35584_REG_FWDSTAT1_INDEX              ((uint8)5U)
#define GP_TLF35584_REG_RSYSPCFG0_INDEX             ((uint8)6U)
#define GP_TLF35584_REG_RSYSPCFG1_INDEX             ((uint8)7U)
#define GP_TLF35584_REG_RWDCFG0_INDEX               ((uint8)8U)
#define GP_TLF35584_REG_RWDCFG1_INDEX               ((uint8)9U)
#define GP_TLF35584_REG_RFWDCFG_INDEX               ((uint8)10U)
#define GP_TLF35584_REG_RWWDCFG0_INDEX              ((uint8)11U)
#define GP_TLF35584_REG_RWWDCFG1_INDEX              ((uint8)12U)
#define GP_TLF35584_REG_WWDSCMD_INDEX               ((uint8)13U)
/*flag register index*/
#define GP_TLF35584_FLAG_REG_NUM                    ((uint8)12U)
#define GP_TLF35584_REG_INITERR_INDEX               ((uint8)0U)
#define GP_TLF35584_REG_IF_INDEX                    ((uint8)1U)
#define GP_TLF35584_REG_SYSSF_INDEX                 ((uint8)2U)
#define GP_TLF35584_REG_WKSF_INDEX                  ((uint8)3U)
#define GP_TLF35584_REG_SPISF_INDEX                 ((uint8)4U)
#define GP_TLF35584_REG_SYSFAIL_INDEX               ((uint8)5U)
#define GP_TLF35584_REG_MONSF0_INDEX                ((uint8)6U)
#define GP_TLF35584_REG_MONSF1_INDEX                ((uint8)7U)
#define GP_TLF35584_REG_MONSF2_INDEX                ((uint8)8U)
#define GP_TLF35584_REG_MONSF3_INDEX                ((uint8)9U)
#define GP_TLF35584_REG_OTFAIL_INDEX                ((uint8)10U)
#define GP_TLF35584_REG_OTWRNSF_INDEX               ((uint8)11U)
#define GP_TLF35584_FLAG_RECOVER_NUM                ((uint8)8U)
/*protect register confirm*/
#define GP_TLF35584_PROTECT_REG_NUM                 ((uint8)7U)
#define GP_TLF35584_STU_REG_OFFSET                  ((uint8)6U)
#define GP_TLF35584_INIT_REG_OFFSET                 ((uint8)2U)
/*wdg parameter cfg for init phase*/
#define GP_TLF35584_INIT_WDCFG0                     ((uint8)0xF7U)
#define GP_TLF35584_INIT_WDCFG1                     ((uint8)0x0FU)
#define GP_TLF35584_INIT_FWDCFG                     ((uint8)0x1FU)
#define GP_TLF35584_WWD_ENABLE                      ((uint8)0x1AU)
#define GP_TLF35584_WWD_OW_TIME                     ((uint8)0x00U)
#define GP_TLF35584_WWD_CW_TIME                     ((uint8)0x00U)
/***********************************************************************************************************************
**                                      Typedef Definition                                                            **
***********************************************************************************************************************/
/*$TDST-B$*/
typedef struct Gp_TLF35584_ErrorData
{
    uint32  ErrRecord_au32[GP_TLF35584_FAULT_SIGNAL_NUMS];/*Gp_TLF35584 error record*/
    uint32  DriverErrPath_u32;  /*Gp_TLF35584 driver error path*/
    uint32  BistErrPath_u32;/*Gp_TLF35584 bist error path*/
}Gp_TLF35584_ErrorDataType; /*Gp_TLF35584 error data type*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct Gp_TLF35584_SpiData
{
    uint16  TxBuf_au16[GP_TLF35584_SPI_BUFFER_LENGTH];/*Gp_TLF35584 tx buffer*/
    uint16  RxBuf_au16[GP_TLF35584_SPI_BUFFER_LENGTH];/*Gp_TLF35584 rx buffer*/
    uint16  CntTx_u16; /*Gp_TLF35584 tx length*/
}Gp_TLF35584_SpiDataType;   /*Gp_TLF35584 spi data type*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct Gp_TLF35584_StatusData
{
    uint8   WdMode_u8; /*Gp_TLF35584 wdg mode*/
    uint8   LastSeed_u8; /*Gp_TLF35584 last seed*/
    uint8   RspCnt_u8;  /*Gp_TLF35584 response counter*/
    uint8   LastWwdScmd_u8; /*Gp_TLF35584 last scmd*/
    uint8   FwdErrCnt_u8; /*Gp_TLF35584 FWD error cnt*/
    uint8   WwdErrCnt_u8; /*Gp_TLF35584 WWD error cnt*/
    uint8   DeviceState_u8; /*Gp_TLF35584 device state*/
    uint8   WakeupSource_u8;/*Gp_TLF35584 wake-up source*/
    uint8   ResetType_u8; /*Gp_TLF35584 reset type*/
    uint8   SystemPor_bk_u8; /*Gp_TLF35584 power-on flag--backup for called by bist*/
    uint8   WakeupSource_bk_u8;/*Gp_TLF35584 wake-up source*/
    uint8   ResetType_bk_u8; /*Gp_TLF35584 reset type*/
    uint8   InitStatus_u8; /*Gp_TLF35584 init status*/
    uint8   BistSuccessful_u8; /*Gp_TLF35584 bist successful*/
    uint8   BistFunctCalled_u8;/*bist function be called or not*/
    uint8   SpiCheckFlag_u8; /*spi check flag*/
    uint8   StateVar_u8;/*Gp_TLF35584 state variable value*/
}Gp_TLF35584_StatusDataType;/*Gp_TLF35584 status data type*/
/*$TDST-E$*/

typedef struct Gp_TLF35584_FaultDebonceData
{
    uint32  FaultHistoryCnt_u32; /*to record total time when find a fault*/
    uint8   ReadFaultCnt_u8;    /*Gp_TLF35584 read fault count*/
    uint8   FaultThreshold_u8;  /*record max time when a */
}Gp_TLF35584_FaultDebonceDataType;
/*$TDST-B$*/
typedef struct Gp_TLF35584_AllData
{
    Gp_TLF35584_ErrorDataType   ErrData_tst;/*Gp_TLF35584 error data type*/
    Gp_TLF35584_SpiDataType     SpiData_tst;/*Gp_TLF35584 spi data type*/
    Gp_TLF35584_StatusDataType  StatusData_tst;/*Gp_TLF35584 status data type*/
    Gp_TLF35584_FaultDebonceDataType FaultDebonce_tst;  /*fault denounce data type*/
    uint16  WdgTimeCnt_u16; /*Gp_TLF35584 state machine count*/
    uint16  WdgMTrigCnt_u16; /*Gp_TLF35584 state machine count*/
    uint8   SetMode_u8;     /*Gp_TLF35584 set mode variable*/
    uint8   ReInitRetry_u8;/*retry for go to normal*/
    boolean WdiRestoreFlag_b; /*Gp_TLF35584 WDI flag*/
    boolean WdgSwitch_b;      /*set by wdgif to disable or enable wdg*/
    boolean ClearFirstWdgEventFlg_b;
}Gp_TLF35584_AllDataType;   /*Gp_TLF35584 all data type*/
/*$TDST-E$*/

#endif /* GP_TLF35584_TYPES_H_ */
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


