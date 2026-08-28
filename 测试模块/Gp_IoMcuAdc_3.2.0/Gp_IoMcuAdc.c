/***********************************************************************************************************************
**--------------------------------------------------------------------------------------------------------------------**
** Copyright (c) 2022 by G-Pulse.       All rights reserved.
** This software is copyright protected and proprietary to G-Pulse.
** G-Pulse grants to you only those rights as set out in the license conditions.
** All other rights remain with G-Pulse.
**--------------------------------------------------------------------------------------------------------------------**
**
* Administrative Information
* $Namespace_: ..\ Gp_IoMcuAdc$
* $Class_____: C$
* $Name______: Gp_IoMcuAdc.c$
* $ArchiVer__: 3$
* $FcVeri____: 2.0$
* $Author____: hexiangyu$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_IoMcuAdc driver source file
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_IoMcuAdc.h"
#include "Gp_IoMcuAdc_Callout.h"

/***********************************************************************************************************************
**                                      Macro Definition                                                              **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Typedef Definition                                                            **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Static Local Variables Definition                                             **
***********************************************************************************************************************/
/*$LV-B$*/
#if (GP_IOMCUADC_CORE0_ENABLE == STD_ON)
#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_START
#include "Gp_IoMcuAdc_MemMap.h"

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
/*DET runtime buffer core0*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_DevErrorDetectType  Gp_IoMcuAdc_bufDetCore0_ltst;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

/*ADC signal runtime buffer core0*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigType  Gp_IoMcuAdc_bufAdcSigCore0_latst[GP_IOMCUADC_SIG_NUM_IN_CORE0];
/*ADC signal local implement runtime buffer core0*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigLocalImplType Gp_IoMcuAdc_bufAdcSigLocalImplCore0_latst\
[GP_IOMCUADC_SIG_NUM_IN_CORE0];

#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_STOP
#include "Gp_IoMcuAdc_MemMap.h"
#endif  /*(GP_IOMCUADC_CORE0_ENABLE == STD_ON)*/

#if (GP_IOMCUADC_CORE1_ENABLE == STD_ON)
#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_START
#include "Gp_IoMcuAdc_MemMap.h"

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
/*DET runtime buffer core1*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_DevErrorDetectType  Gp_IoMcuAdc_bufDetCore1_ltst;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

/*ADC signal runtime buffer core1*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigType  Gp_IoMcuAdc_bufAdcSigCore1_latst[GP_IOMCUADC_SIG_NUM_IN_CORE1];
/*ADC signal local implement runtime buffer core1*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigLocalImplType Gp_IoMcuAdc_bufAdcSigLocalImplCore1_latst\
[GP_IOMCUADC_SIG_NUM_IN_CORE1];

#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_STOP
#include "Gp_IoMcuAdc_MemMap.h"
#endif  /*(GP_IOMCUADC_CORE1_ENABLE == STD_ON)*/

#if (GP_IOMCUADC_CORE2_ENABLE == STD_ON)
#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_START
#include "Gp_IoMcuAdc_MemMap.h"

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
/*DET runtime buffer core2*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_DevErrorDetectType  Gp_IoMcuAdc_bufDetCore2_ltst;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

/*ADC signal runtime buffer core2*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigType  Gp_IoMcuAdc_bufAdcSigCore2_latst[GP_IOMCUADC_SIG_NUM_IN_CORE2];
/*ADC signal local implement runtime buffer core2*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigLocalImplType Gp_IoMcuAdc_bufAdcSigLocalImplCore2_latst\
[GP_IOMCUADC_SIG_NUM_IN_CORE2];

#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_STOP
#include "Gp_IoMcuAdc_MemMap.h"
#endif  /*(GP_IOMCUADC_CORE2_ENABLE == STD_ON)*/

#if (GP_IOMCUADC_CORE3_ENABLE == STD_ON)
#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_START
#include "Gp_IoMcuAdc_MemMap.h"

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
/*DET runtime buffer core3*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_DevErrorDetectType  Gp_IoMcuAdc_bufDetCore3_ltst;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

/*ADC signal runtime buffer core3*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigType  Gp_IoMcuAdc_bufAdcSigCore3_latst[GP_IOMCUADC_SIG_NUM_IN_CORE3];
/*ADC signal local implement runtime buffer core3*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigLocalImplType Gp_IoMcuAdc_bufAdcSigLocalImplCore3_latst\
[GP_IOMCUADC_SIG_NUM_IN_CORE3];

#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_STOP
#include "Gp_IoMcuAdc_MemMap.h"
#endif  /*(GP_IOMCUADC_CORE3_ENABLE == STD_ON)*/

#if (GP_IOMCUADC_CORE4_ENABLE == STD_ON)
#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_START
#include "Gp_IoMcuAdc_MemMap.h"

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
/*DET runtime buffer core4*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_DevErrorDetectType  Gp_IoMcuAdc_bufDetCore4_ltst;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

/*ADC signal runtime buffer core4*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigType  Gp_IoMcuAdc_bufAdcSigCore4_latst[GP_IOMCUADC_SIG_NUM_IN_CORE4];
/*ADC signal local implement runtime buffer core4*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigLocalImplType Gp_IoMcuAdc_bufAdcSigLocalImplCore4_latst\
[GP_IOMCUADC_SIG_NUM_IN_CORE4];

#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_STOP
#include "Gp_IoMcuAdc_MemMap.h"
#endif  /*(GP_IOMCUADC_CORE4_ENABLE == STD_ON)*/

#if (GP_IOMCUADC_CORE5_ENABLE == STD_ON)
#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_START
#include "Gp_IoMcuAdc_MemMap.h"

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
/*DET runtime buffer core5*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_DevErrorDetectType  Gp_IoMcuAdc_bufDetCore5_ltst;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

/*ADC signal runtime buffer core5*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigType  Gp_IoMcuAdc_bufAdcSigCore5_latst[GP_IOMCUADC_SIG_NUM_IN_CORE5];
/*ADC signal local implement runtime buffer core5*/
GP_IOMCUADC_STATIC_ Gp_IoMcuAdc_AdcSigLocalImplType Gp_IoMcuAdc_bufAdcSigLocalImplCore5_latst\
[GP_IOMCUADC_SIG_NUM_IN_CORE5];

#define GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_STOP
#include "Gp_IoMcuAdc_MemMap.h"
#endif  /*(GP_IOMCUADC_CORE5_ENABLE == STD_ON)*/

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_START
#include "Gp_IoMcuAdc_MemMap.h"

/*FC runtime buffer address container for multi-core*/
GP_IOMCUADC_STATIC_ const   Gp_IoMcuAdc_RunTimeType Gp_IoMcuAdc_rtCont_lcatst[GP_IOMCUADC_CORE_NUM] =
{
        /*global constant runtime buffer address of core0*/
        {
#if (GP_IOMCUADC_CORE0_ENABLE == STD_ON)
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
                &Gp_IoMcuAdc_bufDetCore0_ltst,
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
                &Gp_IoMcuAdc_bufAdcSigCore0_latst[0U],
                &Gp_IoMcuAdc_bufAdcSigLocalImplCore0_latst[0U],
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigLocalImplType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_CORE0_ENABLE == STD_ON)*/
        },
        /*global constant runtime buffer address of core1*/
        {
#if (GP_IOMCUADC_CORE1_ENABLE == STD_ON)
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
                &Gp_IoMcuAdc_bufDetCore1_ltst,
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
                &Gp_IoMcuAdc_bufAdcSigCore1_latst[0U],
                &Gp_IoMcuAdc_bufAdcSigLocalImplCore1_latst[0U],
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigLocalImplType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_CORE1_ENABLE == STD_ON)*/
        },
        /*global constant runtime buffer address of core2*/
        {
#if (GP_IOMCUADC_CORE2_ENABLE == STD_ON)
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
                &Gp_IoMcuAdc_bufDetCore2_ltst,
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
                &Gp_IoMcuAdc_bufAdcSigCore2_latst[0U],
                &Gp_IoMcuAdc_bufAdcSigLocalImplCore2_latst[0U],
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigLocalImplType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_CORE2_ENABLE == STD_ON)*/
        },
        /*global constant runtime buffer address of core3*/
        {
#if (GP_IOMCUADC_CORE3_ENABLE == STD_ON)
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
                &Gp_IoMcuAdc_bufDetCore3_ltst,
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
                &Gp_IoMcuAdc_bufAdcSigCore3_latst[0U],
                &Gp_IoMcuAdc_bufAdcSigLocalImplCore3_latst[0U],
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigLocalImplType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_CORE3_ENABLE == STD_ON)*/
        },
        /*global constant runtime buffer address of core4*/
        {
#if (GP_IOMCUADC_CORE4_ENABLE == STD_ON)
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
                &Gp_IoMcuAdc_bufDetCore4_ltst,
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
                &Gp_IoMcuAdc_bufAdcSigCore4_latst[0U],
                &Gp_IoMcuAdc_bufAdcSigLocalImplCore4_latst[0U],
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigLocalImplType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_CORE4_ENABLE == STD_ON)*/
        },
        /*global constant runtime buffer address of core5*/
        {
#if (GP_IOMCUADC_CORE5_ENABLE == STD_ON)
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
                &Gp_IoMcuAdc_bufDetCore5_ltst,
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
                &Gp_IoMcuAdc_bufAdcSigCore5_latst[0U],
                &Gp_IoMcuAdc_bufAdcSigLocalImplCore5_latst[0U],
#else
                (Gp_IoMcuAdc_DevErrorDetectType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigType*)GP_IOMCUADC_NULL_PTR,
                (Gp_IoMcuAdc_AdcSigLocalImplType*)GP_IOMCUADC_NULL_PTR,
#endif  /*(GP_IOMCUADC_CORE5_ENABLE == STD_ON)*/
        },
};

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
#include "Gp_IoMcuAdc_MemMap.h"
/*$LV-E$*/

/***********************************************************************************************************************
**                                      Static Local Function Declaration                                             **
***********************************************************************************************************************/
#define GP_IOMCUADC_CODE_START
#include "Gp_IoMcuAdc_MemMap.h"

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)

GP_IOMCUADC_STATIC_ boolean Gp_IoMcuAdc_CheckInitStu
(
    Gp_IoMcuAdc_IfIdType IfId_t,
    const Gp_IoMcuAdc_RunTimeType* Rt_cptst
);
GP_IOMCUADC_STATIC_ boolean Gp_IoMcuAdc_CheckArgIn
(
    Gp_IoMcuAdc_IfIdType IfId_t,
    const Gp_IoMcuAdc_AdcSigMappingCfgType* SmCfg_cptst,
    const Gp_IoMcuAdc_RunTimeType* Rt_cptst,
    uint32 ChkCoreId_u32,
    uint16 ChkId_u16,
    uint8* ChkArgIn_pu8
);

#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

GP_IOMCUADC_STATIC_ void    Gp_IoMcuAdc_GetDiag
(
    const Gp_IoMcuAdc_CfgType* Cfg_cptst,
    const Gp_IoMcuAdc_RunTimeType* Rt_cptst,
    uint32 CoreId_u32,
    uint8 ChlIdx_u8
);
GP_IOMCUADC_STATIC_ void    Gp_IoMcuAdc_GetAdcRaw
(
    const Gp_IoMcuAdc_CfgType* Cfg_cptst,
    const Gp_IoMcuAdc_RunTimeType* Rt_cptst,
    uint32 CoreId_u32,
    uint8 ChlIdx_u8
);
GP_IOMCUADC_STATIC_ boolean Gp_IoMcuAdc_CheckAdcRawValidity(uint32 AdcRes_u32);

#define GP_IOMCUADC_CODE_STOP
#include "Gp_IoMcuAdc_MemMap.h"

/***********************************************************************************************************************
**                                      Function Source Code                                                          **
***********************************************************************************************************************/
#define GP_IOMCUADC_CODE_START
#include "Gp_IoMcuAdc_MemMap.h"

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_CheckInitStu
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : Gp_IoMcuAdc_IfIdType IfId_t - interface ID
** Parameter[in]    : const Gp_IoMcuAdc_RunTimeType* Rt_cptst - pointer to FC runtime buffer
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : boolean - TRUE/FALSE
** Description      : Gp_IoMcuAdc check initialized status.
the function will check if the initialization is completed,
and return TRUE if initialization status is valid, else return FASLE and save error value.
hint: it is useful for integration trouble shooting.
DET buffer only keep the newest error value, if there is a error value recorded yet, it will be covered.
***********************************************************************************************************************/
GP_IOMCUADC_STATIC_ boolean Gp_IoMcuAdc_CheckInitStu
(
    Gp_IoMcuAdc_IfIdType IfId_t,
    const Gp_IoMcuAdc_RunTimeType* Rt_cptst
)
{
    boolean ErrFlag_b = FALSE;
    Gp_IoMcuAdc_DevErrorDetectType* Det_ptst = Rt_cptst->Det_ptst;

    /*check if the initialization is completed*/
    if (Det_ptst->InitStu_t == GP_IOMCUADC_INITSTU_INITED)
    {
        ErrFlag_b = FALSE;
    }
    else
    {
        ErrFlag_b = TRUE;
        /*record uninitialized error*/
        Det_ptst->IfId_t = IfId_t;
        Det_ptst->ErrStu_t = GP_IOMCUADC_ERRSTU_UNINITED;
    }

    return (ErrFlag_b);
}

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_CheckArgIn
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : Gp_IoMcuAdc_IfIdType IfId_t - interface ID
** Parameter[in]    : const Gp_IoMcuAdc_AdcSigMappingCfgType* SmCfg_cptst - pointer to FC signal mapping Cfg
** Parameter[in]    : const Gp_IoMcuAdc_RunTimeType* Rt_cptst - pointer to FC runtime buffer
** Parameter[in]    : uint32 ChkCoreId_u32 - core ID 0~5
** Parameter[in]    : uint16 ChkId_u16 - signal ID 0~0xFFFF
** Parameter[in]    : uint8* ChkArgIn_pu8 - pointer to buffer of output argument
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : boolean - TRUE/FALSE
** Description      : Gp_IoMcuAdc check argument input.
the function will check if the argument is valid, including the ID is in range of configuration
and the pointer argument a is not null, and the ID is belong to current core.
it will return TRUE if argument is valid, else return FASLE and save error value.
hint: it is useful for integration trouble shooting.
DET buffer only keep the newest error value, if there is a error value recorded yet, it will be covered.
***********************************************************************************************************************/
GP_IOMCUADC_STATIC_ boolean Gp_IoMcuAdc_CheckArgIn
(
    Gp_IoMcuAdc_IfIdType IfId_t,
    const Gp_IoMcuAdc_AdcSigMappingCfgType* SmCfg_cptst,
    const Gp_IoMcuAdc_RunTimeType* Rt_cptst,
    uint32 ChkCoreId_u32,
    uint16 ChkId_u16,
    uint8* ChkArgIn_pu8
)
{
    boolean ErrFlag_b = FALSE;
    Gp_IoMcuAdc_DevErrorDetectType* Det_ptst = Rt_cptst->Det_ptst;

    /*check if the argument is valid*/
    if ((ChkId_u16 < GP_IOMCUADC_SIG_NUM) &&
            (ChkArgIn_pu8 != GP_IOMCUADC_NULL_PTR))
    {
        /*check if the core ID is consistent*/
        if (SmCfg_cptst[ChkId_u16].MappingCoreId_u32 == ChkCoreId_u32)
        {
            ErrFlag_b = FALSE;
        }
        else
        {
            ErrFlag_b = TRUE;
            /*record signal mapping inconsistent error, signal ID is not belong to this core*/
            Det_ptst->IfId_t = IfId_t;
            Det_ptst->ErrStu_t = GP_IOMCUADC_ERRSTU_SIG_MAP_INCONSISTENT;
        }
    }
    else
    {
        ErrFlag_b = TRUE;
        /*record invalid argument error*/
        Det_ptst->IfId_t = IfId_t;
        Det_ptst->ErrStu_t = GP_IOMCUADC_ERRSTU_INVALID_ARG;
    }

    return (ErrFlag_b);
}

#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_GetDiag
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : const Gp_IoMcuAdc_CfgType* Cfg_cptst - pointer to FC Cfg
** Parameter[in]    : const Gp_IoMcuAdc_RunTimeType* Rt_cptst - pointer to FC runtime buffer
** Parameter[in]    : uint32 CoreId_u32 - core ID 0~5
** Parameter[in]    : uint8 ChlIdx_u8 - channel index 0~255
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_IoMcuAdc get diagnostic data.
the function will get diagnostic data from two ways, callout function or get 0 value.
hint: this FC version do not support diagnostic function, so it will always get 0 for diagnostic result.
user should choose callout way and realize diagnostic function in callout function if there is special requirement.
***********************************************************************************************************************/
GP_IOMCUADC_STATIC_ void    Gp_IoMcuAdc_GetDiag
(
    const Gp_IoMcuAdc_CfgType* Cfg_cptst,
    const Gp_IoMcuAdc_RunTimeType* Rt_cptst,
    uint32 CoreId_u32,
    uint8 ChlIdx_u8
)
{
    boolean FuncCompl_b = TRUE;
    uint32  Diag_u32 = 0U;

    if (Cfg_cptst->AdcSigLocalCfg_cptst[ChlIdx_u8].DiagCalloutFunc_b == TRUE)
    {
        /*this signal use callout function for special handling*/
        FuncCompl_b = Gp_IoMcuAdc_CalloutGetDiag(CoreId_u32, ChlIdx_u8, &Diag_u32);
        if (FuncCompl_b == FALSE)
        {
            /*record callout function get diagnostic data error*/
            Rt_cptst->AdcSigLocalImpl_ptst[ChlIdx_u8].AdcSigErr_t |=\
                    GP_IOMCUADC_ADCSIGERRSTU_CALLOUT_GET_DIAG_FAILED;
        }
        else
        {
            /*save diagnostic data in buffer*/
            Rt_cptst->AdcSig_ptst[ChlIdx_u8].Diag_u32 = Diag_u32;
        }
    }
    else
    {
        /*get diagnostic data, no function in current version*/
        Rt_cptst->AdcSig_ptst[ChlIdx_u8].Diag_u32 = 0U;
    }
}

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_GetAdcRaw
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : const Gp_IoMcuAdc_CfgType* Cfg_cptst - pointer to FC Cfg
** Parameter[in]    : const Gp_IoMcuAdc_RunTimeType* Rt_cptst - pointer to FC runtime buffer
** Parameter[in]    : uint32 CoreId_u32 - core ID 0~5
** Parameter[in]    : uint8 ChlIdx_u8 - channel index 0~255
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_IoMcuAdc get ADC raw.
the function will get ADC raw from two ways, callout function or result address of configuration.
and it will check validity if it is configured. program will set invalid value if check result is invalid.
hint: if result of check validity is invalid, program will set invalid value.
if user need get the ADC raw directly and do not want be affected by invalid value,
user should be set FALSE for the check validity configuration item of this signal.
user should choose callout way and realize get ADC raw function in callout function if there is special requirement.
***********************************************************************************************************************/
GP_IOMCUADC_STATIC_ void    Gp_IoMcuAdc_GetAdcRaw
(
    const Gp_IoMcuAdc_CfgType* Cfg_cptst,
    const Gp_IoMcuAdc_RunTimeType* Rt_cptst,
    uint32 CoreId_u32,
    uint8 ChlIdx_u8
)
{
    boolean FuncCompl_b = TRUE;
    uint16  AdcRaw_u16 = 0U;
    uint32  AdcRes_u32 = 0U;
    boolean Validity_b = FALSE;

    if (Cfg_cptst->AdcSigLocalCfg_cptst[ChlIdx_u8].AdcRawCalloutFunc_b == TRUE)
    {
        /*this signal use callout function for special handling*/
        FuncCompl_b = Gp_IoMcuAdc_CalloutGetAdcRaw(CoreId_u32, ChlIdx_u8, &AdcRaw_u16);
        if (FuncCompl_b == FALSE)
        {
            /*record callout function get ADC raw error*/
            Rt_cptst->AdcSigLocalImpl_ptst[ChlIdx_u8].AdcSigErr_t |=\
                    GP_IOMCUADC_ADCSIGERRSTU_CALLOUT_GET_ADCRAW_FAILED;
        }
        else
        {
            /*save ADC raw in buffer*/
            Rt_cptst->AdcSig_ptst[ChlIdx_u8].AdcRaw_u16 = AdcRaw_u16;
        }
    }
    else
    {
        /*get ADC raw from result address of configuration*/
        AdcRes_u32 = *Cfg_cptst->AdcSigLocalCfg_cptst[ChlIdx_u8].ResRegOrBuf_pu32;
        if (Cfg_cptst->AdcSigLocalCfg_cptst[ChlIdx_u8].AdcRawCheckValidity_b == TRUE)
        {
            /*get ADC raw validity by check conversion completed bit*/
            Validity_b = Gp_IoMcuAdc_CheckAdcRawValidity(AdcRes_u32);
            if (Validity_b == TRUE)
            {
                /*write ADC raw*/
                Rt_cptst->AdcSig_ptst[ChlIdx_u8].AdcRaw_u16 = (uint16)(AdcRes_u32 & 0x0000FFFFU);
            }
            else
            {
                /*write invalid value,
                this is used for read and check valid ADC raw
                until conversion is completed in special application.*/
                Rt_cptst->AdcSig_ptst[ChlIdx_u8].AdcRaw_u16 = GP_IOMCUADC_ADCRAW_INVALID;
            }
        }
        else
        {
            /*do not check validity and write ADC raw*/
            Rt_cptst->AdcSig_ptst[ChlIdx_u8].AdcRaw_u16 = (uint16)(AdcRes_u32 & 0x0000FFFFU);
        }
    }
}

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_CheckAdcRawValidity
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint32 AdcRes_u32 - ADC result
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : boolean - TRUE/FALSE
** Description      : Gp_IoMcuAdc check ADC raw validity.
the function will check if new data bit of ADC result is valid, it means conversion is completed,
and return TRUE else return FASLE.
hint: the function code is depend on microcontroller which is configurated.
***********************************************************************************************************************/
GP_IOMCUADC_STATIC_ boolean Gp_IoMcuAdc_CheckAdcRawValidity(uint32 AdcRes_u32)
{
    boolean Validity_b = FALSE;

#if ((GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_AURIX2G_MCAL) || \
        (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_TRAVEO2G_MCAL))
    /*check bit31*/
    AdcRes_u32 = AdcRes_u32 & GP_IOMCUADC_ADCRAW_NEW_DATA_FLAG_POSI_AURIX2G_TRAVEO2G;
    if (AdcRes_u32 == GP_IOMCUADC_ADCRAW_NEW_DATA_FLAG_POSI_AURIX2G_TRAVEO2G)
    {
        /*conversion is completed, ADC raw is valid*/
        Validity_b = TRUE;
    }
    else
    {
        /*conversion is uncompleted*/
        Validity_b = FALSE;
    }
#elif (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_STELLARPX_MCAL)
    /*check bit19*/
    AdcRes_u32 = AdcRes_u32 & GP_IOMCUADC_ADCRAW_NEW_DATA_FLAG_POSI_STELLARPX;
    if (AdcRes_u32 == GP_IOMCUADC_ADCRAW_NEW_DATA_FLAG_POSI_STELLARPX)
    {
        /*conversion is completed, ADC raw is valid*/
        Validity_b = TRUE;
    }
    else
    {
        /*conversion is uncompleted*/
        Validity_b = FALSE;
    }
#elif (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_AURIX3G_MCAL)
    Validity_b = TRUE;
#elif (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_UNDEFINED)

#endif  /*#if ((GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_AURIX2G_MCAL) || \
        (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_TRAVEO2G_MCAL))*/
    return (Validity_b);
}

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_Init
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_IoMcuAdc initialization function.
the function will set initial value for AdcSig buffer and AdcSig local implement buffer of all channels,
and start ADC hardware conversion by invoke corresponding ADC function of MCAL.
the function should be invoked in the core which is enable and after ADC initialization function of MCAL.
***********************************************************************************************************************/
void    Gp_IoMcuAdc_Init(void)
{
    const   Gp_IoMcuAdc_CfgType*    Cfg_cptst = &Gp_IoMcuAdc_cfgCont_vcatst[0U];
    const   Gp_IoMcuAdc_RunTimeType*    Rt_cptst = &Gp_IoMcuAdc_rtCont_lcatst[0U];
    uint32  CoreId_u32 = 0U;
    uint32  Cnt_u32 = 0U;
    uint8   ChlNum_u8 = 0U;
    Std_ReturnType  Ret_t = E_OK;
    boolean FuncCompl_b = TRUE;

    /*get core ID*/
    CoreId_u32 = Gp_IoMcuAdc_CalloutGetCoreId();
    /*get configuration address of current core to local address*/
    Cfg_cptst = &Gp_IoMcuAdc_cfgCont_vcatst[CoreId_u32];
    /*get runtime buffer address of current core to local address*/
    Rt_cptst = &Gp_IoMcuAdc_rtCont_lcatst[CoreId_u32];

    /*initialization for ADC signal channel*/
    ChlNum_u8 = Cfg_cptst->ChlNum_u8;
    for (Cnt_u32 = 0U; Cnt_u32 < (uint32)ChlNum_u8; Cnt_u32++)
    {
        /*set initial value*/
        Rt_cptst->AdcSig_ptst[Cnt_u32].AdcRaw_u16 = GP_IOMCUADC_ADCRAW_INVALID;
        Rt_cptst->AdcSig_ptst[Cnt_u32].Diag_u32 = 0U;
        Rt_cptst->AdcSigLocalImpl_ptst[Cnt_u32].PollingCnt_u16 = 0U;
        Rt_cptst->AdcSigLocalImpl_ptst[Cnt_u32].AdcSigErr_t = GP_IOMCUADC_ADCSIGERRSTU_NO_ERR;
    }

#if ((GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_AURIX2G_MCAL) || \
        (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_AURIX3G_MCAL) || \
        (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_TRAVEO2G_MCAL) || \
        (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_STELLARPX_MCAL))
    /*enable HW trigger*/
    for (Cnt_u32 = 0U; Cnt_u32 < (uint32)Cfg_cptst->GrpNum_u8; Cnt_u32++)
    {
        /*invoke MCAL ADC interface*/
        /*
        Adc_SetupResultBuffer use AdcRaw_u16 as dummy buffer,
        procedure will not fill dummy buffer by call MCAL function.
        Adc_SetupResultBuffer should be completed before invoke Adc_EnableHardwareTrigger
        to avoid DET error of ADC.
        */
        Ret_t = Adc_SetupResultBuffer
        (
            (Adc_GroupType)Cfg_cptst->GrpCfg_cpu32[Cnt_u32],
            (Adc_ValueGroupType*)&Rt_cptst->AdcSig_ptst[Cnt_u32].AdcRaw_u16
        );
        Adc_EnableHardwareTrigger((Adc_GroupType)Cfg_cptst->GrpCfg_cpu32[Cnt_u32]);
    }
#elif (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_UNDEFINED)

#endif  /*#if ((GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_AURIX2G_MCAL) || \
        (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_AURIX3G_MCAL) || \
        (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_TRAVEO2G_MCAL) || \
        (GP_IOMCUADC_SPEC_DEP_IF == GP_IOMCUADC_SPEC_DEP_IF_STELLARPX_MCAL))*/

    /*extra initialization use callout function for special handling*/
    FuncCompl_b = Gp_IoMcuAdc_CalloutInit(CoreId_u32);

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    if ((Ret_t == E_NOT_OK) || (FuncCompl_b == FALSE))
    {
        /*record initialization failed error*/
        Rt_cptst->Det_ptst->IfId_t = GP_IOMCUADC_IFID_INIT;
        Rt_cptst->Det_ptst->ErrStu_t = GP_IOMCUADC_ERRSTU_INIT_FAILED;
        /*initialization failed*/
        Rt_cptst->Det_ptst->InitStu_t = GP_IOMCUADC_INITSTU_INIT_FAILED;
    }
    else
    {
        /*initialization completed*/
        Rt_cptst->Det_ptst->InitStu_t = GP_IOMCUADC_INITSTU_INITED;
    }

    /*clear running counter*/
    Rt_cptst->Det_ptst->RunCnt_u32 = 0U;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

}

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_MainFunction
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Gp_IoMcuAdc period function.
the function will get ADC raw and diagnostic data of all channels except directly read channel
according to the configured period, and save in runtime buffer.
the function should be invoked in the core which is enable and in period task after Gp_IoMcuAdc_Init is completed.
hint: every channel which is not configured as directly read has a polling count
which is increased by MainFunction periodically, when it reach the count maximum,
it will be cleared, then read ADC raw and diagnostic data.
***********************************************************************************************************************/
void    Gp_IoMcuAdc_MainFunction(void)
{
    const   Gp_IoMcuAdc_CfgType*    Cfg_cptst = &Gp_IoMcuAdc_cfgCont_vcatst[0U];
    const   Gp_IoMcuAdc_RunTimeType*    Rt_cptst = &Gp_IoMcuAdc_rtCont_lcatst[0U];
    uint32  CoreId_u32 = 0U;
    uint32  Cnt_u32 = 0U;
    uint16  ChlNum_u8 = 0U;

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    boolean ErrFlag_b = FALSE;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

    /*get core ID*/
    CoreId_u32 = Gp_IoMcuAdc_CalloutGetCoreId();
    /*get configuration address of current core to local address*/
    Cfg_cptst = &Gp_IoMcuAdc_cfgCont_vcatst[CoreId_u32];
    /*get runtime buffer address of current core to local address*/
    Rt_cptst = &Gp_IoMcuAdc_rtCont_lcatst[CoreId_u32];

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    /*check if the initialization is completed*/
    ErrFlag_b = Gp_IoMcuAdc_CheckInitStu(GP_IOMCUADC_IFID_MAINFUNC, Rt_cptst);
    if (ErrFlag_b == FALSE)
    {
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
        /*get ADC raw of all channels and save in runtime buffer*/
        ChlNum_u8 = Cfg_cptst->ChlNum_u8;
        for (Cnt_u32 = 0U; Cnt_u32 < (uint32)ChlNum_u8; Cnt_u32++)
        {
            /*to avoid read conflict,
            MainFunction only read ADC raw and diagnostic data when directly read is FALSE.*/
            if (Cfg_cptst->AdcSigLocalCfg_cptst[Cnt_u32].DirectlyRead_b == FALSE)
            {
                /*
                polling count increase periodically, when reach the count maximum,
                it will be cleared, then read ADC raw and diagnostic data.
                */
                Rt_cptst->AdcSigLocalImpl_ptst[Cnt_u32].PollingCnt_u16++;
                if (Rt_cptst->AdcSigLocalImpl_ptst[Cnt_u32].PollingCnt_u16 >=
                        Cfg_cptst->AdcSigLocalCfg_cptst[Cnt_u32].PollingCntMax_u16)
                {
                    Rt_cptst->AdcSigLocalImpl_ptst[Cnt_u32].PollingCnt_u16 = 0U;
                    /*read ADC raw*/
                    Gp_IoMcuAdc_GetAdcRaw(Cfg_cptst, Rt_cptst, CoreId_u32, (uint8)Cnt_u32);
                    /*get diagnostic data*/
                    Gp_IoMcuAdc_GetDiag(Cfg_cptst, Rt_cptst, CoreId_u32, (uint8)Cnt_u32);
                }
                else
                {
                    /*do nothing*/
                }
            }
            else
            {
                /*do nothing*/
            }
        }
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
        /*MainFunction running counter increasing*/
        Rt_cptst->Det_ptst->RunCnt_u32++;
    }
    else
    {
        /*do nothing*/
    }
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

}

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_GetAdcSigDiag
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint16 Id_u16 - signal ID 0~0xFFFF
** Parameter[inout] : None
** Parameter[out]   : uint32* Diag_pu32 - pointer to buffer of diagnostic data
** Return Value     : Std_ReturnType - E_OK/E_NOT_OK
** Description      : Gp_IoMcuAdc provide diagnostic data of AdcSig interface.
user will get diagnostic data of AdcSig through output argument for the corresponding ID.
the function should be invoked in the core which is enable and after Gp_IoMcuAdc_Init is completed
and Gp_IoMcuAdc_MainFunction has read signal value of all channels except directly read channel.
hint: the function read the diagnostic data from internal function for current input ID
if the channel of current ID is configured as directly read channel,
else read the diagnostic data from local buffer which is written by Gp_IoMcuAdc_MainFunction.
***********************************************************************************************************************/
Std_ReturnType  Gp_IoMcuAdc_GetAdcSigDiag(uint16 Id_u16, uint32* Diag_pu32)
{
    Std_ReturnType Ret_t = E_NOT_OK;
    const   Gp_IoMcuAdc_CfgType*    Cfg_cptst = &Gp_IoMcuAdc_cfgCont_vcatst[0U];
    const   Gp_IoMcuAdc_RunTimeType*    Rt_cptst = &Gp_IoMcuAdc_rtCont_lcatst[0U];
    const   Gp_IoMcuAdc_AdcSigMappingCfgType*   SmCfg_cptst = &Gp_IoMcuAdc_cfgAdcSigMapping_vcatst[0U];
    uint32  CoreId_u32 = 0U;
    uint8   ChlIdx_u8 = 0U;

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    boolean ErrFlag1_b = FALSE;
    boolean ErrFlag2_b = FALSE;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

    /*get core ID*/
    CoreId_u32 = Gp_IoMcuAdc_CalloutGetCoreId();
    /*get configuration address of current core to local address*/
    Cfg_cptst = &Gp_IoMcuAdc_cfgCont_vcatst[CoreId_u32];
    /*get runtime buffer address of current core to local address*/
    Rt_cptst = &Gp_IoMcuAdc_rtCont_lcatst[CoreId_u32];

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    /*check one by one, do not jump over because of error reporting of one check,
    this is for covering all error status.*/
    ErrFlag1_b = Gp_IoMcuAdc_CheckInitStu(GP_IOMCUADC_IFID_GETADCSIGDIAG, Rt_cptst);
    ErrFlag2_b = Gp_IoMcuAdc_CheckArgIn
    (
        GP_IOMCUADC_IFID_GETADCSIGDIAG,
        SmCfg_cptst,
        Rt_cptst,
        CoreId_u32,
        Id_u16,
        (uint8*)Diag_pu32
    );
    ErrFlag1_b = ErrFlag1_b | ErrFlag2_b;
    if (ErrFlag1_b == FALSE)
    {
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
        /*get channel index of current signal ID according to the signal mapping configuration*/
        ChlIdx_u8 = SmCfg_cptst[Id_u16].MappingChlIdx_u8;

        /*get diagnostic data*/
        if (Cfg_cptst->AdcSigLocalCfg_cptst[ChlIdx_u8].DirectlyRead_b == TRUE)
        {
            /*get diagnostic data directly from callout function or get 0 value,
            diagnostic data is also save in buffer for debug observation.*/
            Gp_IoMcuAdc_GetDiag(Cfg_cptst, Rt_cptst, CoreId_u32, ChlIdx_u8);
            *Diag_pu32 = Rt_cptst->AdcSig_ptst[ChlIdx_u8].Diag_u32;
        }
        else
        {
            /*get diagnostic data from buffer which is read by period in MainFunction*/
            *Diag_pu32 = Rt_cptst->AdcSig_ptst[ChlIdx_u8].Diag_u32;
        }

        Ret_t = E_OK;
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    }
    else
    {
        Ret_t = E_NOT_OK;
    }
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

    return (Ret_t);
}

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_GetAdcSigAdcRaw
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint16 Id_u16 - signal ID 0~0xFFFF
** Parameter[inout] : None
** Parameter[out]   : uint16* AdcRaw_pu16 - pointer to buffer of ADC raw
** Return Value     : Std_ReturnType - E_OK/E_NOT_OK
** Description      : Gp_IoMcuAdc provide ADC raw of AdcSig interface.
user will get ADC raw of AdcSig through output argument for the corresponding ID.
the function should be invoked in the core which is enable and after Gp_IoMcuAdc_Init is completed
and Gp_IoMcuAdc_MainFunction has read signal value of all channels except directly read channel.
hint: the function read the ADC raw from internal function for current input ID
if the channel of current ID is configured as directly read channel,
else read the ADC raw from local buffer which is written by Gp_IoMcuAdc_MainFunction.
***********************************************************************************************************************/
Std_ReturnType  Gp_IoMcuAdc_GetAdcSigAdcRaw(uint16 Id_u16, uint16* AdcRaw_pu16)
{
    Std_ReturnType Ret_t = E_NOT_OK;
    const   Gp_IoMcuAdc_CfgType*    Cfg_cptst = &Gp_IoMcuAdc_cfgCont_vcatst[0U];
    const   Gp_IoMcuAdc_RunTimeType*    Rt_cptst = &Gp_IoMcuAdc_rtCont_lcatst[0U];
    const   Gp_IoMcuAdc_AdcSigMappingCfgType*   SmCfg_cptst = &Gp_IoMcuAdc_cfgAdcSigMapping_vcatst[0U];
    uint32  CoreId_u32 = 0U;
    uint8   ChlIdx_u8 = 0U;

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    boolean ErrFlag1_b = FALSE;
    boolean ErrFlag2_b = FALSE;
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

    /*get core ID*/
    CoreId_u32 = Gp_IoMcuAdc_CalloutGetCoreId();
    /*get configuration address of current core to local address*/
    Cfg_cptst = &Gp_IoMcuAdc_cfgCont_vcatst[CoreId_u32];
    /*get runtime buffer address of current core to local address*/
    Rt_cptst = &Gp_IoMcuAdc_rtCont_lcatst[CoreId_u32];

#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    /*check one by one, do not jump over because of error reporting of one check,
    this is for covering all error status.*/
    ErrFlag1_b = Gp_IoMcuAdc_CheckInitStu(GP_IOMCUADC_IFID_GETADCSIGADCRAW, Rt_cptst);
    ErrFlag2_b = Gp_IoMcuAdc_CheckArgIn
    (
        GP_IOMCUADC_IFID_GETADCSIGADCRAW,
        SmCfg_cptst,
        Rt_cptst,
        CoreId_u32,
        Id_u16,
        (uint8*)AdcRaw_pu16
    );
    ErrFlag1_b = ErrFlag1_b | ErrFlag2_b;
    if (ErrFlag1_b == FALSE)
    {
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/
        /*get channel index of current signal ID according to the signal mapping configuration*/
        ChlIdx_u8 = SmCfg_cptst[Id_u16].MappingChlIdx_u8;

        /*get ADC raw*/
        if (Cfg_cptst->AdcSigLocalCfg_cptst[ChlIdx_u8].DirectlyRead_b == TRUE)
        {
            /*get ADC raw directly from callout function or result address,
            ADC raw is also save in buffer for debug observation.*/
            Gp_IoMcuAdc_GetAdcRaw(Cfg_cptst, Rt_cptst, CoreId_u32, ChlIdx_u8);
            *AdcRaw_pu16 = Rt_cptst->AdcSig_ptst[ChlIdx_u8].AdcRaw_u16;
        }
        else
        {
            /*get ADC raw from buffer which is read by period in MainFunction*/
            *AdcRaw_pu16 = Rt_cptst->AdcSig_ptst[ChlIdx_u8].AdcRaw_u16;
        }

        Ret_t = E_OK;
#if (GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)
    }
    else
    {
        Ret_t = E_NOT_OK;
    }
#endif  /*(GP_IOMCUADC_DEV_ERROR_DETECT == STD_ON)*/

    return (Ret_t);
}

#define GP_IOMCUADC_CODE_STOP
#include "Gp_IoMcuAdc_MemMap.h"


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


