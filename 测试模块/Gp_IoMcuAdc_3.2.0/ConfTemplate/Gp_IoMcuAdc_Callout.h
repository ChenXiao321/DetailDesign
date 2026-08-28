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
* $Name______: Gp_IoMcuAdc_Callout.h$
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
** Gp_IoMcuAdc driver callout header file
***********************************************************************************************************************/
#ifndef GP_IOMCUADC_CALLOUT_H_
#define GP_IOMCUADC_CALLOUT_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_IoMcuAdc_Types.h"
/*other FC header file inclusion if necessary*/

/***********************************************************************************************************************
**                                      Global Function Prototypes                                                    **
***********************************************************************************************************************/
#define GP_IOMCUADC_CODE_START
#include "Gp_IoMcuAdc_MemMap.h"

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_CalloutGetCoreId
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : uint32 - core ID
** Description      : get core ID callout function, the function should get core ID from lower driver,
and make sure of core ID is available(core ID is valid and is enabled in configuration and is used as index 0~5).
***********************************************************************************************************************/
extern  uint32  Gp_IoMcuAdc_CalloutGetCoreId(void);

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_CalloutInit
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint32 CoreId_u32 - core ID 0~5
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : boolean - TRUE/FALSE
** Description      : initialize callout function for special application requirement.
***********************************************************************************************************************/
extern  boolean Gp_IoMcuAdc_CalloutInit(uint32 CoreId_u32);

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_CalloutGetDiag
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint32 CoreId_u32 - core ID 0~5
** Parameter[in]    : uint8 ChlIdx_u8 - channel index 0~255
** Parameter[inout] : None
** Parameter[out]   : uint32* Diag_pu32 - pointer to buffer of diagnostic data
** Return Value     : boolean - TRUE/FALSE
** Description      : get diagnostic data callout function for special handling.
***********************************************************************************************************************/
extern  boolean Gp_IoMcuAdc_CalloutGetDiag(uint32 CoreId_u32, uint8 ChlIdx_u8, uint32* Diag_pu32);

/***********************************************************************************************************************
** Function Name    : Gp_IoMcuAdc_CalloutGetAdcRaw
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint32 CoreId_u32 - core ID 0~5
** Parameter[in]    : uint8 ChlIdx_u8 - channel index 0~255
** Parameter[inout] : None
** Parameter[out]   : uint16* AdcRaw_pu16 - pointer to buffer of ADC raw
** Return Value     : boolean - TRUE/FALSE
** Description      : get ADC raw callout function for special handling.
***********************************************************************************************************************/
extern  boolean Gp_IoMcuAdc_CalloutGetAdcRaw(uint32 CoreId_u32, uint8 ChlIdx_u8, uint16* AdcRaw_pu16);

#define GP_IOMCUADC_CODE_STOP
#include "Gp_IoMcuAdc_MemMap.h"


#endif /* GP_IOMCUADC_CALLOUT_H_ */

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


