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
* $Name______: Gp_IoMcuAdc_MemMap.h$
* $ArchiVer__: 3$
* $FcVeri____: 1.0$
* $Author____: hexiangyu$
*
* $Configuration or generate Date,Time: 16:50 . 2022/1/24 $
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: Yes
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
**
**  Gp_IoMcuAdc driver MemMap header file
**
***********************************************************************************************************************/
#ifndef GP_IOMCUADC_MEMMAP_H_
#define GP_IOMCUADC_MEMMAP_H_

/**
 *                                  G-Pulse memory layout standard
 *
 *  Type             Tasking         Hightec        Definition                          Section
 *  .text           code                ax          _CODE_(START/STOP)                  Code.(*).(*)
 *  .bss_clear      farbss              awB         CLEAR_FAR_DATA                      ClearFarData.
 *  .bss_noclear    farnoclear          awB         NO_CLEAR_FAR_DATA                   NoClearFarData.
 *  .zbss_clear     nearbss             awBz        CLEAR_NEAR_DATA                     ClearNearData.
 *  .zbss_noclear   nearnoclear         awBz        NO_CLEAR_NEAR_DATA                  NoClearNearData.
 *  .sbss           a0bss               awBs        CLEAR_A0_DATA                       ClearA0Data.
 *  .data           fardata             aw          INIT_FAR_DATA                       InitFarData.
 *  .zdata          neardata            awz         INIT_NEAR_DATA                      InitNearData.
 *  .sdata          a0data              aws         INIT_A0_DATA                        InitA0Data.
 *  .rodata         farrom              a           CONST_FAR_DATA                      ConstFarData.
 *  .zrodata        nearrom             az          CONST_NEAR_DATA                     ConstNearData.
 *  .rodata_a1      a1rom               as          CONST_A1_DATA                       ConstA1Data.
 *
 **/

#define GP_IOMCUADC_MEMMAP_ERROR        /*Make error for check*/

/*For compiler TASKING*/
#if defined __TASKING__
/************************************************* Data Section *******************************************************/

/**
 * !!!!NOTE!!!!:
 *  attribute order:
 *  start:  addressing mode - clear - align
 *  stop:   align - addressing mode - clear
 */

#if defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_START
    #pragma section farbss "ClearFarData.Align4.Core0.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_START
    #pragma section farbss "ClearFarData.Align4.Core1.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_START
    #pragma section farbss "ClearFarData.Align4.Core2.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_START
    #pragma section farbss "ClearFarData.Align4.Core3.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_START
    #pragma section farbss "ClearFarData.Align4.Core4.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_START
    #pragma section farbss "ClearFarData.Align4.Core5.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_START
    #pragma section farrom "ConstFarData.Align4.Global.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma align 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
    #pragma align restore
    #pragma default_near_size restore
    #pragma section farrom restore
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_START
    #pragma section farrom "ConstFarData.Align4.Core0.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma align 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_STOP
    #pragma align restore
    #pragma default_near_size restore
    #pragma section farrom restore
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_START
    #pragma section farrom "ConstFarData.Align4.Core1.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma align 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_STOP
    #pragma align restore
    #pragma default_near_size restore
    #pragma section farrom restore
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_START
    #pragma section farrom "ConstFarData.Align4.Core2.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma align 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_STOP
    #pragma align restore
    #pragma default_near_size restore
    #pragma section farrom restore
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_START
    #pragma section farrom "ConstFarData.Align4.Core3.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma align 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_STOP
    #pragma align restore
    #pragma default_near_size restore
    #pragma section farrom restore
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_START
    #pragma section farrom "ConstFarData.Align4.Core4.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma align 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_STOP
    #pragma align restore
    #pragma default_near_size restore
    #pragma section farrom restore
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_START
    #pragma section farrom "ConstFarData.Align4.Core5.Gp_IoMcuAdc"
    #pragma default_near_size 0
    #pragma align 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_STOP
    #pragma align restore
    #pragma default_near_size restore
    #pragma section farrom restore
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

/************************************************* Code Section *******************************************************/
#elif defined GP_IOMCUADC_CODE_START
    #pragma section code "Code.Gp_IoMcuAdc"
    #undef GP_IOMCUADC_CODE_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CODE_STOP
    #pragma section code restore
    #undef GP_IOMCUADC_CODE_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

/************************************************ Compiler optimize ***************************************************/
#elif defined GP_IOMCUADC_COMPILER_OPTIMIZE_START
    #pragma optimize O2
    #pragma profiling off
    #pragma tradeoff 2
    #undef GP_IOMCUADC_COMPILER_OPTIMIZE_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_COMPILER_OPTIMIZE_STOP
    #pragma tradeoff restore
    #pragma profiling restore
    #pragma endoptimize
    #undef GP_IOMCUADC_COMPILER_OPTIMIZE_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR
 #endif
 
/*For compiler HIGHTEC*/
#elif defined __HIGHTEC__

/************************************************* Data Section *******************************************************/
#if defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_START
    #pragma section  "ClearFarData.Align4.Core0.Gp_IoMcuAdc" awB 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_STOP
    #pragma section 
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE0_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_START
    #pragma section  "ClearFarData.Align4.Core1.Gp_IoMcuAdc" awB 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_STOP
    #pragma section 
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE1_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_START
    #pragma section  "ClearFarData.Align4.Core2.Gp_IoMcuAdc" awB 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_STOP
    #pragma section 
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE2_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_START
    #pragma section  "ClearFarData.Align4.Core3.Gp_IoMcuAdc" awB 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_STOP
    #pragma section 
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE3_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_START
    #pragma section  "ClearFarData.Align4.Core4.Gp_IoMcuAdc" awB 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_STOP
    #pragma section 
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE4_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_START
    #pragma section  "ClearFarData.Align4.Core5.Gp_IoMcuAdc" awB 4
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_STOP
    #pragma section 
    #undef GP_IOMCUADC_CLEAR_FAR_DATA_ALIGN4_CORE5_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_START
    #pragma section  "ConstFarData.Align4.Global.Gp_IoMcuAdc" a 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
    #pragma section 
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_START
    #pragma section  "ConstFarData.Align4.Core0.Gp_IoMcuAdc" a 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_STOP
    #pragma section 
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE0_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_START
    #pragma section  "ConstFarData.Align4.Core1.Gp_IoMcuAdc" a 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_STOP
    #pragma section 
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE1_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_START
    #pragma section  "ConstFarData.Align4.Core2.Gp_IoMcuAdc" a 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_STOP
    #pragma section 
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE2_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_START
    #pragma section  "ConstFarData.Align4.Core3.Gp_IoMcuAdc" a 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_STOP
    #pragma section 
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE3_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_START
    #pragma section  "ConstFarData.Align4.Core4.Gp_IoMcuAdc" a 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_STOP
    #pragma section 
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE4_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_START
    #pragma section  "ConstFarData.Align4.Core5.Gp_IoMcuAdc" a 4
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_STOP
    #pragma section 
    #undef GP_IOMCUADC_CONST_FAR_DATA_ALIGN4_CORE5_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

/************************************************* Code Section *******************************************************/
#elif defined GP_IOMCUADC_CODE_START
    #pragma section  "Code.Gp_IoMcuAdc" ax
    #undef GP_IOMCUADC_CODE_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_CODE_STOP
    #pragma section 
    #undef GP_IOMCUADC_CODE_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR

/************************************************ Compiler optimize ***************************************************/
#elif defined GP_IOMCUADC_COMPILER_OPTIMIZE_START
    #pragma GCC optimize ("-O2")
    #undef GP_IOMCUADC_COMPILER_OPTIMIZE_START
    #undef GP_IOMCUADC_MEMMAP_ERROR

#elif defined GP_IOMCUADC_COMPILER_OPTIMIZE_STOP
    #pragma GCC reset_options
    #undef GP_IOMCUADC_COMPILER_OPTIMIZE_STOP
    #undef GP_IOMCUADC_MEMMAP_ERROR
#endif
#endif  /*__TASKING__ or __HIGHTEC__*/

#if defined GP_IOMCUADC_MEMMAP_ERROR
#error "!!! Gp_IoMcuAdc_MemMap.h,Wrong pragma command !!!"
#endif

#undef GP_IOMCUADC_MEMMAP_H_    /*Must be #undef here*/
#endif  /*GP_IOMCUADC_MEMMAP_H_*/

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


