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
* $Name______: Gp_IoMcuAdc_Cfg.h$
* $ArchiVer__: 3$
* $FcVeri____: 2.0$
* $Author____: hexiangyu$
*
* $Configuration or generate Date,Time: 19:35 . 2022/1/18 $
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: Yes
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_IoMcuAdc driver CFG header file
***********************************************************************************************************************/
#ifndef GP_IOMCUADC_CFG_H_
#define GP_IOMCUADC_CFG_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Std_Types.h"
/*other FC header file inclusion if necessary*/

/***********************************************************************************************************************
**                                      Macro Definition                                                              **
***********************************************************************************************************************/

/*AURIX2G core*/

#define GP_IOMCUADC_CORE0_ENABLE        (STD_ON)
#define GP_IOMCUADC_CORE1_ENABLE        (STD_OFF)
#define GP_IOMCUADC_CORE2_ENABLE        (STD_OFF)
#define GP_IOMCUADC_CORE3_ENABLE        (STD_OFF)
#define GP_IOMCUADC_CORE4_ENABLE        (STD_OFF)
#define GP_IOMCUADC_CORE5_ENABLE        (STD_OFF)

/*core0 configuration*/
/*if current core is enable, current core contain one group and one signal at least*/
#if (GP_IOMCUADC_CORE0_ENABLE == STD_ON)
#define GP_IOMCUADC_GRP_NUM_IN_CORE0    ((uint8)1U)
#define GP_IOMCUADC_SIG_NUM_IN_CORE0    ((uint8)1U)

#endif  /*(GP_IOMCUADC_CORE0_ENABLE == STD_ON)*/

/*core1 configuration*/
/*if current core is enable, current core contain one group and one signal at least*/
#if (GP_IOMCUADC_CORE1_ENABLE == STD_ON)
#define GP_IOMCUADC_GRP_NUM_IN_CORE1    ((uint8)0U)
#define GP_IOMCUADC_SIG_NUM_IN_CORE1    ((uint8)0U)

#endif  /*(GP_IOMCUADC_CORE1_ENABLE == STD_ON)*/

/*core2 configuration*/
/*if current core is enable, current core contain one group and one signal at least*/
#if (GP_IOMCUADC_CORE2_ENABLE == STD_ON)
#define GP_IOMCUADC_GRP_NUM_IN_CORE2    ((uint8)0U)
#define GP_IOMCUADC_SIG_NUM_IN_CORE2    ((uint8)0U)

#endif  /*(GP_IOMCUADC_CORE2_ENABLE == STD_ON)*/

/*core3 configuration*/
/*if current core is enable, current core contain one group and one signal at least*/
#if (GP_IOMCUADC_CORE3_ENABLE == STD_ON)
#define GP_IOMCUADC_GRP_NUM_IN_CORE3    ((uint8)0U)
#define GP_IOMCUADC_SIG_NUM_IN_CORE3    ((uint8)0U)

#endif  /*(GP_IOMCUADC_CORE3_ENABLE == STD_ON)*/

/*core4 configuration*/
/*if current core is enable, current core contain one group and one signal at least*/
#if (GP_IOMCUADC_CORE4_ENABLE == STD_ON)
#define GP_IOMCUADC_GRP_NUM_IN_CORE4    ((uint8)0U)
#define GP_IOMCUADC_SIG_NUM_IN_CORE4    ((uint8)0U)

#endif  /*(GP_IOMCUADC_CORE4_ENABLE == STD_ON)*/

/*core5 configuration*/
/*if current core is enable, current core contain one group and one signal at least*/
#if (GP_IOMCUADC_CORE5_ENABLE == STD_ON)
#define GP_IOMCUADC_GRP_NUM_IN_CORE5    ((uint8)0U)
#define GP_IOMCUADC_SIG_NUM_IN_CORE5    ((uint8)0U)

#endif  /*(GP_IOMCUADC_CORE5_ENABLE == STD_ON)*/

/*signal number is total number of providing from all cores*/
#define GP_IOMCUADC_SIG_NUM (1U)

/*development error detect*/
#define GP_IOMCUADC_DEV_ERROR_DETECT        (STD_ON)

/*define for specific dependent interface*/
#define GP_IOMCUADC_SPEC_DEP_IF_UNDEFINED   (0U)
#define GP_IOMCUADC_SPEC_DEP_IF_AURIX2G_MCAL    (1U)
#define GP_IOMCUADC_SPEC_DEP_IF_AURIX3G_MCAL    (2U)
#define GP_IOMCUADC_SPEC_DEP_IF_TRAVEO2G_MCAL   (3U)
#define GP_IOMCUADC_SPEC_DEP_IF_STELLARPX_MCAL  (4U)

/*specific dependent interface*/
#define GP_IOMCUADC_SPEC_DEP_IF (GP_IOMCUADC_SPEC_DEP_IF_UNDEFINED)

#endif /* GP_IOMCUADC_CFG_H_ */

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


