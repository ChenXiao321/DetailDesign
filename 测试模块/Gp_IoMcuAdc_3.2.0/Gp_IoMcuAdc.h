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
* $Name______: Gp_IoMcuAdc.h$
* $ArchiVer__: 3$
* $FcVeri____: 2.0$
* $Author____: hexiangyu$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_IoMcuAdc driver header file
***********************************************************************************************************************/
#ifndef GP_IOMCUADC_H_
#define GP_IOMCUADC_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_IoMcuAdc_CfgData.h"
/***********************************************************************************************************************
**                                      Global Function Prototypes                                                    **
***********************************************************************************************************************/
#define GP_IOMCUADC_CODE_START
#include "Gp_IoMcuAdc_MemMap.h"

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
extern  void    Gp_IoMcuAdc_Init(void);

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
extern  void    Gp_IoMcuAdc_MainFunction(void);

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
extern  Std_ReturnType  Gp_IoMcuAdc_GetAdcSigDiag(uint16 Id_u16, uint32* Diag_pu32);

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
extern  Std_ReturnType  Gp_IoMcuAdc_GetAdcSigAdcRaw(uint16 Id_u16, uint16* AdcRaw_pu16);

#define GP_IOMCUADC_CODE_STOP
#include "Gp_IoMcuAdc_MemMap.h"


#endif /* GP_IOMCUADC_H_ */

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


