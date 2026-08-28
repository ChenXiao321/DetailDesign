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
* $Name______: Gp_IoMcuAdc_Cfg.c$
* $ArchiVer__: 3$
* $FcVeri____: 2.0$
* $Author____: hexiangyu$
*
* $Configuration or generate Date,Time: 19:35 2022/1/18 $
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: Yes
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_IoMcuAdc driver CFG file
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_IoMcuAdc_CfgData.h"

/***********************************************************************************************************************
**                                      Static Local Variables Definition                                             **
***********************************************************************************************************************/
#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_START
#include "Gp_IoMcuAdc_MemMap.h"

GP_IOMCUADC_STATIC_ const   Gp_IoMcuAdc_AdcSigLocalCfgType  Gp_IoMcuAdc_cfgAdcSigLocalCore0_lcatst\
[GP_IOMCUADC_SIG_NUM_IN_CORE0] =
{
        { (uint32*)GP_IOMCUADC_NULL_PTR, (uint32*)GP_IOMCUADC_NULL_PTR, 10U, FALSE, FALSE, FALSE, FALSE, },
};

GP_IOMCUADC_STATIC_ const   uint32  Gp_IoMcuAdc_cfgGrpCore0_lcau32[GP_IOMCUADC_GRP_NUM_IN_CORE0] =
{
        0,
};

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_STOP
#include "Gp_IoMcuAdc_MemMap.h"


/***********************************************************************************************************************
**                                      Global Variables Definition                                                   **
***********************************************************************************************************************/
#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_START
#include "Gp_IoMcuAdc_MemMap.h"

const   Gp_IoMcuAdc_CfgType Gp_IoMcuAdc_cfgCont_vcatst[GP_IOMCUADC_CORE_NUM] =
{
        /*global constant configuration address of core0*/
        {
#if (GP_IOMCUADC_CORE0_ENABLE == STD_ON)
                &Gp_IoMcuAdc_cfgAdcSigLocalCore0_lcatst[0U],
                &Gp_IoMcuAdc_cfgGrpCore0_lcau32[0U],
                GP_IOMCUADC_GRP_NUM_IN_CORE0,
                GP_IOMCUADC_SIG_NUM_IN_CORE0,
#else
                (Gp_IoMcuAdc_AdcSigLocalCfgType*)GP_IOMCUADC_NULL_PTR,
                (uint32*)GP_IOMCUADC_NULL_PTR,
                0U,
                0U,
#endif  /*(GP_IOMCUADC_CORE0_ENABLE == STD_ON)*/
        },
        /*global constant configuration address of core1*/
        {
#if (GP_IOMCUADC_CORE1_ENABLE == STD_ON)
                &Gp_IoMcuAdc_cfgAdcSigLocalCore1_lcatst[0U],
                &Gp_IoMcuAdc_cfgGrpCore1_lcau32[0U],
                GP_IOMCUADC_GRP_NUM_IN_CORE1,
                GP_IOMCUADC_SIG_NUM_IN_CORE1,
#else
                (Gp_IoMcuAdc_AdcSigLocalCfgType*)GP_IOMCUADC_NULL_PTR,
                (uint32*)GP_IOMCUADC_NULL_PTR,
                0U,
                0U,
#endif  /*(GP_IOMCUADC_CORE1_ENABLE == STD_ON)*/
        },
        /*global constant configuration address of core2*/
        {
#if (GP_IOMCUADC_CORE2_ENABLE == STD_ON)
                &Gp_IoMcuAdc_cfgAdcSigLocalCore2_lcatst[0U],
                &Gp_IoMcuAdc_cfgGrpCore2_lcau32[0U],
                GP_IOMCUADC_GRP_NUM_IN_CORE2,
                GP_IOMCUADC_SIG_NUM_IN_CORE2,
#else
                (Gp_IoMcuAdc_AdcSigLocalCfgType*)GP_IOMCUADC_NULL_PTR,
                (uint32*)GP_IOMCUADC_NULL_PTR,
                0U,
                0U,
#endif  /*(GP_IOMCUADC_CORE2_ENABLE == STD_ON)*/
        },
        /*global constant configuration address of core3*/
        {
#if (GP_IOMCUADC_CORE3_ENABLE == STD_ON)
                &Gp_IoMcuAdc_cfgAdcSigLocalCore3_lcatst[0U],
                &Gp_IoMcuAdc_cfgGrpCore3_lcau32[0U],
                GP_IOMCUADC_GRP_NUM_IN_CORE3,
                GP_IOMCUADC_SIG_NUM_IN_CORE3,
#else
                (Gp_IoMcuAdc_AdcSigLocalCfgType*)GP_IOMCUADC_NULL_PTR,
                (uint32*)GP_IOMCUADC_NULL_PTR,
                0U,
                0U,
#endif  /*(GP_IOMCUADC_CORE3_ENABLE == STD_ON)*/
        },
        /*global constant configuration address of core4*/
        {
#if (GP_IOMCUADC_CORE4_ENABLE == STD_ON)
                &Gp_IoMcuAdc_cfgAdcSigLocalCore4_lcatst[0U],
                &Gp_IoMcuAdc_cfgGrpCore4_lcau32[0U],
                GP_IOMCUADC_GRP_NUM_IN_CORE4,
                GP_IOMCUADC_SIG_NUM_IN_CORE4,
#else
                (Gp_IoMcuAdc_AdcSigLocalCfgType*)GP_IOMCUADC_NULL_PTR,
                (uint32*)GP_IOMCUADC_NULL_PTR,
                0U,
                0U,
#endif  /*(GP_IOMCUADC_CORE4_ENABLE == STD_ON)*/
        },
        /*global constant configuration address of core5*/
        {
#if (GP_IOMCUADC_CORE5_ENABLE == STD_ON)
                &Gp_IoMcuAdc_cfgAdcSigLocalCore5_lcatst[0U],
                &Gp_IoMcuAdc_cfgGrpCore5_lcau32[0U],
                GP_IOMCUADC_GRP_NUM_IN_CORE5,
                GP_IOMCUADC_SIG_NUM_IN_CORE5,
#else
                (Gp_IoMcuAdc_AdcSigLocalCfgType*)GP_IOMCUADC_NULL_PTR,
                (uint32*)GP_IOMCUADC_NULL_PTR,
                0U,
                0U,
#endif  /*(GP_IOMCUADC_CORE5_ENABLE == STD_ON)*/
        },
};

const   Gp_IoMcuAdc_AdcSigMappingCfgType    Gp_IoMcuAdc_cfgAdcSigMapping_vcatst[GP_IOMCUADC_SIG_NUM] =
{
        { GP_IOMCUADC_CORE0_ID, 0U, },
};

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_STOP
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_START
#include "Gp_IoMcuAdc_MemMap.h"

#define GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_STOP
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


