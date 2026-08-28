/***********************************************************************************************************************
**--------------------------------------------------------------------------------------------------------------------**
** Copyright (c)  2022 by G-Pulse.      All rights reserved.
** This software is copyright protected and proprietary to G-Pulse.
** G-Pulse grants to you only those rights as set out in the license conditions.
** All other rights remain with G-Pulse.
**--------------------------------------------------------------------------------------------------------------------**
**
* Administrative Information
* $Namespace_: ..\ Gp_IoMcuAdc$
* $Class_____: C$
* $Name______: Gp_IoMcuAdc_Types.h$
* $ArchiVer__: 3$
* $FcVeri____: 2.0$
* $Author____: hexiangyu$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_IoMcuAdc driver types header file
***********************************************************************************************************************/
#ifndef GP_IOMCUADC_TYPES_H_
#define GP_IOMCUADC_TYPES_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_IoMcuAdc_Cfg.h"

/***********************************************************************************************************************
**                                      Macro Definition                                                              **
***********************************************************************************************************************/
#define GP_IOMCUADC_UNUSED_PARAMETER(VariableName)  (void)(VariableName)
#define GP_IOMCUADC_NULL_PTR                            ((void *) 0)

#ifndef GP_IOMCUADC_LOCAL_INLINE_
#if defined __TASKING__
#define GP_IOMCUADC_LOCAL_INLINE_       static inline
#elif defined __HIGHTEC__
#define GP_IOMCUADC_LOCAL_INLINE_       static inline __attribute__ ((always_inline))
#elif defined __GHS__
#define GP_IOMCUADC_LOCAL_INLINE_       static inline
#endif  /*__TASKING__*/
#endif  /*GP_IOMCUADC_LOCAL_INLINE_*/

#ifndef GP_IOMCUADC_STATIC_
#define GP_IOMCUADC_STATIC_     static
#endif  /*GP_IOMCUADC_STATIC_*/

/*GP_IOMCUADC core ID is used as index of multi-core data definition and should be start from 0*/
#define GP_IOMCUADC_CORE0_ID    ((uint32)0U)
#define GP_IOMCUADC_CORE1_ID    ((uint32)1U)
#define GP_IOMCUADC_CORE2_ID    ((uint32)2U)
#define GP_IOMCUADC_CORE3_ID    ((uint32)3U)
#define GP_IOMCUADC_CORE4_ID    ((uint32)4U)
#define GP_IOMCUADC_CORE5_ID    ((uint32)5U)

/*define core number*/
#define GP_IOMCUADC_CORE_NUM    ((uint8)6U)

/*define for ADC raw invalid value*/
#define GP_IOMCUADC_ADCRAW_INVALID  ((uint16)0xFFFFU)

/*define for ADC raw new data available flag position(bit31) of AURIX2G and TRAVEO2G*/
#define GP_IOMCUADC_ADCRAW_NEW_DATA_FLAG_POSI_AURIX2G_TRAVEO2G  ((uint32)0x80000000U)
/*define for ADC raw new data available flag position(bit19) of STELLARPX*/
#define GP_IOMCUADC_ADCRAW_NEW_DATA_FLAG_POSI_STELLARPX ((uint32)0x00080000U)

/***********************************************************************************************************************
**                                      Typedef Definition                                                            **
***********************************************************************************************************************/

/*$TDB-B$*/
typedef uint8   Gp_IoMcuAdc_InitStuType;    /*specifies the initialized status type*/
#define GP_IOMCUADC_INITSTU_UNDEF   ((Gp_IoMcuAdc_InitStuType)0x00U)    /*undefined status*/
#define GP_IOMCUADC_INITSTU_INIT_FAILED ((Gp_IoMcuAdc_InitStuType)0x01U)    /*initialization failed*/
#define GP_IOMCUADC_INITSTU_INITED  ((Gp_IoMcuAdc_InitStuType)0x02U)    /*initialized*/
/*$TDB-E$*/

/*$TDB-B$*/
typedef uint8   Gp_IoMcuAdc_IfIdType;   /*specifies the interface ID type*/
#define GP_IOMCUADC_IFID_UNDEF  ((Gp_IoMcuAdc_IfIdType)0x00U)   /*undefined interface ID*/
#define GP_IOMCUADC_IFID_INIT   ((Gp_IoMcuAdc_IfIdType)0x01U)   /*Init*/
#define GP_IOMCUADC_IFID_MAINFUNC   ((Gp_IoMcuAdc_IfIdType)0x02U)   /*MainFunction*/
#define GP_IOMCUADC_IFID_GETADCSIGDIAG  ((Gp_IoMcuAdc_IfIdType)0x03U)   /*GetAdcSigDiag*/
#define GP_IOMCUADC_IFID_GETADCSIGADCRAW    ((Gp_IoMcuAdc_IfIdType)0x04U)   /*GetAdcSigAdcRaw*/
/*$TDB-E$*/

/*$TDB-B$*/
typedef uint8   Gp_IoMcuAdc_ErrStuType; /*specifies the error status type*/
#define GP_IOMCUADC_ERRSTU_NO_ERR   ((Gp_IoMcuAdc_ErrStuType)0x00U) /*no error*/
#define GP_IOMCUADC_ERRSTU_INIT_FAILED  ((Gp_IoMcuAdc_ErrStuType)0x01U) /*initialization failed*/
#define GP_IOMCUADC_ERRSTU_UNINITED ((Gp_IoMcuAdc_ErrStuType)0x02U) /*uninitialized*/
#define GP_IOMCUADC_ERRSTU_INVALID_ARG  ((Gp_IoMcuAdc_ErrStuType)0x03U) /*invalid argument*/
/*signal ID is not belong to this core*/
#define GP_IOMCUADC_ERRSTU_SIG_MAP_INCONSISTENT ((Gp_IoMcuAdc_ErrStuType)0x04U)
/*$TDB-E$*/

/*$TDB-B$*/
/*specifies the ADC signal error status type, each error status occupy 1 bit*/
typedef uint8   Gp_IoMcuAdc_AdcSigErrStuType;
#define GP_IOMCUADC_ADCSIGERRSTU_NO_ERR ((Gp_IoMcuAdc_AdcSigErrStuType)0x00U)   /*no error*/
/*callout get diagnostic data failed*/
#define GP_IOMCUADC_ADCSIGERRSTU_CALLOUT_GET_DIAG_FAILED    ((Gp_IoMcuAdc_AdcSigErrStuType)0x01U)
/*callout get ADC raw failed*/
#define GP_IOMCUADC_ADCSIGERRSTU_CALLOUT_GET_ADCRAW_FAILED  ((Gp_IoMcuAdc_AdcSigErrStuType)0x02U)
/*$TDB-E$*/

/*$TDST-B$*/
typedef struct  Gp_IoMcuAdc_AdcSig
{
    uint32  Diag_u32;   /*diagnostic data*/
    uint16  AdcRaw_u16; /*ADC raw, this data is read from ADC converter of MCU or external device*/
}Gp_IoMcuAdc_AdcSigType;    /*specifies the ADC signal runtime buffer*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct  Gp_IoMcuAdc_AdcSigLocalCfg
{
    uint32* ResRegOrBuf_pu32;   /*pointer to result register or buffer*/
    uint32* ResValidReg_pu32;   /*pointer to result validity register, only available for AURIX3G*/
    uint16  PollingCntMax_u16;  /*ADC signal polling count maximum, ADC signal period/MainFunction period*/
    boolean DiagCalloutFunc_b;  /*enable/disable get diagnostic data callout function for special handling*/
    boolean AdcRawCalloutFunc_b;    /*enable/disable get ADC raw callout function for special handling*/
    boolean DirectlyRead_b; /*enable/disable ADC raw and diagnostic data directly read*/
    boolean AdcRawCheckValidity_b;  /*enable/disable ADC raw check validity*/
}Gp_IoMcuAdc_AdcSigLocalCfgType;    /*specifies the ADC signal local configuration*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct  Gp_IoMcuAdc_AdcSigLocalImpl
{
    uint16  PollingCnt_u16; /*polling count*/
    Gp_IoMcuAdc_AdcSigErrStuType    AdcSigErr_t;    /*ADC signal error status*/
}Gp_IoMcuAdc_AdcSigLocalImplType;   /*specifies the ADC signal local implement*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct  Gp_IoMcuAdc_DevErrorDetect
{
    uint32  RunCnt_u32; /*period interface running counter*/
    Gp_IoMcuAdc_InitStuType InitStu_t;  /*initialized status*/
    Gp_IoMcuAdc_IfIdType    IfId_t;     /*DET record error interface ID*/
    Gp_IoMcuAdc_ErrStuType  ErrStu_t;   /*DET record error status*/
}Gp_IoMcuAdc_DevErrorDetectType;    /*specifies the DET runtime buffer*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct  Gp_IoMcuAdc_Cfg
{
    /*pointer to ADC signal local configuration*/
    const   Gp_IoMcuAdc_AdcSigLocalCfgType* AdcSigLocalCfg_cptst;
    const   uint32* GrpCfg_cpu32;   /*pointer to ADC group configuration*/
    uint8   GrpNum_u8;  /*ADC group number*/
    uint8   ChlNum_u8;  /*ADC channel number*/
}Gp_IoMcuAdc_CfgType;   /*specifies the configuration container*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct  Gp_IoMcuAdc_RunTime
{
    Gp_IoMcuAdc_DevErrorDetectType* Det_ptst;   /*pointer to DET buffer*/
    Gp_IoMcuAdc_AdcSigType* AdcSig_ptst;    /*pointer to ADC signal buffer*/
    Gp_IoMcuAdc_AdcSigLocalImplType*    AdcSigLocalImpl_ptst;   /*pointer to ADC signal local implement buffer*/
}Gp_IoMcuAdc_RunTimeType;   /*specifies the runtime buffer container*/
/*$TDST-E$*/

/*$TDST-B$*/
typedef struct  Gp_IoMcuAdc_AdcSigMappingCfg
{
    uint32  MappingCoreId_u32;  /*signal mapping core*/
    uint8   MappingChlIdx_u8;   /*signal mapping channel index*/
}Gp_IoMcuAdc_AdcSigMappingCfgType;  /*specifies the signal mapping configuration*/
/*$TDST-E$*/


#endif /* GP_IOMCUADC_TYPES_H_ */

/***********************************************************************************************************************
* $ArchiVer History:$
V1:
initial version for G4 platform.
realize Init, MainFunction, AdcSig interface in single core application.
V2:
new feature for multi-core application,
increase up to 6 data sections and 6 const data section for 6 cores,
increase 1 global const data section.
increase new signal interface: EcuVolSig.
V3:
new form for signal and interface, one signal can contain several interface.
delete V2 signal interface(AdcSig and EcuVolSig), instead of AdcSigAdcRaw and AdcSigDiag interface.
delete calibration data section.
***********************************************************************************************************************/

/***********************************************************************************************************************
* $FcVer History:$
2.0.0:
initial code version for V2 architecture.
realize Init, MainFunction, AdcSig, EcuVolSig interface in multi-core application.
this FC version read AURIX 2G ADC result register(configurable) periodically in MainFunction
and output AdcSig and EcuVolSig by the corresponding interface.
support up to 8 multiplexer chips and up to 8 channels of per chip configuration.
3.0.0:
initial code version for V3 architecture.
realize Init, MainFunction, AdcSigAdcRaw, AdcSigDiag interface in multi-core application.
this FC version read AURIX 2G ADC result register(configurable) periodically in MainFunction,
except directly read channels, and output ADC raw and through the corresponding interface.
check diagnostic data periodically in MainFunction and output diagnostic data through the corresponding interface.
new feature as follow:
channel can be configured as directly read channel, and MainFunction will not read result register of this channel
periodically, this is useful in waiting and check read back ADC application or
other application which require to read ADC immediately.
all channels get ADC raw and get diagnostic data can be configured through callout function for special handling.
delete multiplexer chip channel input function.
3.0.1:
no change from 3.0.0, only for updating a new FC version.
3.1.0:
modify the core ID to fixed value, and then it is not to support configuration.
modify the callout function, they should return completed flag except get core ID.
delete the check core ID function, and the get core ID callout function should make sure the core ID is valid
and could be used as core index 0~5.
delete the get runtime buffer address function and get configuration address function.
delete the definition of DET error record length, the DET error only record the newest one.
delete the DET record function.
add ADC signal error type definition and variable for internal error record.
3.2.0:
modify inclusion relationship of files according guideline.
increase configurable dependency interface options for supporting AURIX 2G, AURIX 3G, TRAVEO 2G and STELLAR PX.
increase respective check ADC raw function code for each dependency microcontroller.
***********************************************************************************************************************/


