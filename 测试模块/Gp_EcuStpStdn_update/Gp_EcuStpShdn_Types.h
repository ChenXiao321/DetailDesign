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
* $Name______: Gp_EcuStpShdn_Types.h$
* $ArchiVer__: 1$
* $FcVeri____: 1.0$
* $Author____: hexiangyu$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_EcuStpShdn driver types header file
***********************************************************************************************************************/
#ifndef GP_ECUSTPSHDN_TYPES_H_
#define GP_ECUSTPSHDN_TYPES_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_EcuStpShdn_Cfg.h"

/***********************************************************************************************************************
**                                      Macro Definition                                                              **
***********************************************************************************************************************/
#define GP_ECUSTPSHDN_UNUSED_PARAMETER(VariableName)    (void)(VariableName)
#define GP_ECUSTPSHDN_NULL_PTR                          ((void *) 0)

#ifndef GP_ECUSTPSHDN_STATIC_
#define GP_ECUSTPSHDN_STATIC_       static
#endif

/*$MB-B$*/
#define GP_ECUSTPSHDN_CORE0_ID  ((uint32)0U)    /*core 0 ID*/
#define GP_ECUSTPSHDN_CORE1_ID  ((uint32)1U)    /*core 1 ID*/
#define GP_ECUSTPSHDN_CORE2_ID  ((uint32)2U)    /*core 2 ID*/
#define GP_ECUSTPSHDN_CORE3_ID  ((uint32)3U)    /*core 3 ID*/
#define GP_ECUSTPSHDN_CORE4_ID  ((uint32)4U)    /*core 4 ID*/
#define GP_ECUSTPSHDN_CORE5_ID  ((uint32)5U)    /*core 5 ID*/

/*core number*/
#define GP_ECUSTPSHDN_CORE_NUM  (6U)

/*initialization result record number*/
#define GP_ECUSTPSHDN_INIT_RSLT_REC_NUM (32U)

#define GP_ECUSTPSHDN_MST_TIME_STAMP_PRERUN (0U)    /*master time stamp of PreRun*/
#define GP_ECUSTPSHDN_MST_TIME_STAMP_MST_INIT   (1U)    /*master time stamp of master initialization*/
#define GP_ECUSTPSHDN_MST_TIME_STAMP_MST_POST_INIT  (2U)    /*master time stamp of master post initialization*/
#define GP_ECUSTPSHDN_MST_TIME_STAMP_LAST_SAT_INIT  (3U)    /*master time stamp of last satellite initialization*/

#define GP_ECUSTPSHDN_MST_TIME_STAMP_NUM    (4U)    /*master time stamp number*/
/*$MB-E$*/


/***********************************************************************************************************************
**                                      Typedef Definition                                                            **
***********************************************************************************************************************/

/*$TDB-B$*/
typedef uint8   Gp_EcuStpShdn_StpStageType; /*specifies the barrier status type*/
#define GP_ECUSTPSHDN_STPSTAGE_UNDEF    ((Gp_EcuStpShdn_StpStageType)0x00U) /*undefined status*/
#define GP_ECUSTPSHDN_STPSTAGE_ONE  ((Gp_EcuStpShdn_StpStageType)0x01U) /*startup stage one*/
#define GP_ECUSTPSHDN_STPSTAGE_TWO  ((Gp_EcuStpShdn_StpStageType)0x02U) /*startup stage two*/
#define GP_ECUSTPSHDN_STPSTAGE_THREE    ((Gp_EcuStpShdn_StpStageType)0x03U) /*startup stage three*/
/*$TDB-E$*/

/*$TDB-B$*/
typedef uint8   Gp_EcuStpShdn_SelfTestType; /*specifies the barrier status type*/
#define GP_ECUSTPSHDN_SELFTEST_UNDEF    ((Gp_EcuStpShdn_SelfTestType)0x00U) /*undefined status*/
#define GP_ECUSTPSHDN_SELFTEST_PASS ((Gp_EcuStpShdn_SelfTestType)0x01U) /*self test pass*/
#define GP_ECUSTPSHDN_SELFTEST_FAIL ((Gp_EcuStpShdn_SelfTestType)0x02U) /*self test fail*/
/*$TDB-E$*/

/*$TDST-B$*/
typedef struct  Gp_EcuStpShdn_MstLocalImpl
{
    uint32  TimeStamp_u32[GP_ECUSTPSHDN_MST_TIME_STAMP_NUM];    /*master record startup time stamp*/
    uint32  McuPreTestRslt_u32; /*brief of MCU PreRun test result*/
    uint32  McuRunTestRslt_u32; /*brief of MCU Runtime test result*/
    uint32  SbcInfo_u32;    /*SBC information of startup*/
    Gp_EcuStpShdn_StpStageType  StpStage_t; /*startup stage*/
    Gp_EcuStpShdn_SelfTestType  McuSelfTest_t;  /*MCU self test result*/
    Gp_EcuStpShdn_SelfTestType  SbcSelfTest_t;  /*SBC self test result*/
    uint8   RstTypePlt_u8;  /*platform reset type*/
    uint8   RstTypeMcal_u8; /*MCAL reset type*/
    uint8   RstId_u8;   /*reset ID*/
    uint8   RstCoreId_u8;   /*reset core ID*/
    boolean SafeState_b;    /*safe state flag*/
    boolean TryPwrShdn_b;   /*try power shutdown flag*/
}Gp_EcuStpShdn_MstLocalImplType;    /*specifies the master local implement*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct  Gp_EcuStpShdn_SatLocalImpl
{
    uint32  TimeStamp_u32;  /*satellite record time stamp*/
    uint32  InitRsltAllBits_u32;    /*initialization result all bits*/
    Std_ReturnType  InitCheckRslt_t[GP_ECUSTPSHDN_INIT_RSLT_REC_NUM];   /*initialization check result*/
}Gp_EcuStpShdn_SatLocalImplType;    /*specifies the satellite local implement*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct  Gp_EcuStpShdn_SatRunTime
{
    /*pointer to satellite local implement buffer*/
    volatile    Gp_EcuStpShdn_SatLocalImplType* Impl_ptst;
    /*pointer to satellite initialization function*/
    void    (*StpStageTwo_pf)(volatile  Gp_EcuStpShdn_SatLocalImplType* Impl_ptst);
}Gp_EcuStpShdn_SatRunTimeType;  /*specifies the satellite runtime buffer container*/
/*$TDST-E$*/


#endif /* GP_ECUSTPSHDN_TYPES_H_ */

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