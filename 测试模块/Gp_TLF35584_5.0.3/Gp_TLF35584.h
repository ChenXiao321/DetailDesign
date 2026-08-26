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
* $Name______: Gp_TLF35584.h$
* $ArVeri____: 5$
* $FcVeri____: 0.3$
* $Author____: GWC$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_TLF35584 driver header file
***********************************************************************************************************************/
#ifndef GP_TLF35584_H_
#define GP_TLF35584_H_

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_TLF35584_Cfg.h"

/***********************************************************************************************************************
**                                            Macro Definition                                                        **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Global Variables With Declaration                                             **
***********************************************************************************************************************/
#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_START
#include "Gp_TLF35584_MemMap.h"

extern  const   uint32  Gp_TLF35584_adrDataRec_vcau32[4U];

#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_STOP
#include "Gp_TLF35584_MemMap.h"

/***********************************************************************************************************************
**                                      Global Function Prototypes                                                    **
***********************************************************************************************************************/

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_Init
** Service ID       : None
** Sync/Async       : None
** Reentrancy       : None
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : TLF35584 Init all registers
***********************************************************************************************************************/
extern  void    Gp_TLF35584_Init(void);

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_MainFunction
** Service ID       : None
** Sync/Async       : None
** Reentrancy       : None
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : TLF35584 main state
***********************************************************************************************************************/
extern  void    Gp_TLF35584_MainFunction(void);

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_GetDevSigModeIn
** Service ID       : None
** Sync/Async       : None
** Reentrancy       : None
** Parameter[in]    : uint16 Id_u16
** Parameter[inout] : None
** Parameter[out]   : uint8* DevMode_pu8
** Return Value     : Std_ReturnType
** Description      : App get TLF355584 state

***********************************************************************************************************************/
extern  Std_ReturnType  Gp_TLF35584_GetDevSigModeIn(uint16 Id_u16, uint8* DevMode_pu8);

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_SetDevSigModeOut
** Service ID       : None
** Sync/Async       : None
** Reentrancy       : None
** Parameter[in]    : uint16 Id_u16
** Parameter[in]    : uint8 DevMode_u8
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : Std_ReturnType
** Description      : App set TLF35584 state

***********************************************************************************************************************/
extern  Std_ReturnType  Gp_TLF35584_SetDevSigModeOut(uint16 Id_u16, uint8 DevMode_u8);

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_GetDevSigDiag
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint16 Id_u16
** Parameter[inout] : None
** Parameter[out]   : uint32* DevFault_pu32
** Return Value     : Std_ReturnType
** Description      : get TLF35584 device state
***********************************************************************************************************************/
extern  Std_ReturnType  Gp_TLF35584_GetDevSigDiag(uint16 Id_u16, uint32* DevFault_pu32);

#if(GP_TLF35584_DRIVER_USED_FOR == GP_TLF35584_USED_FOR_APP)
/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_GetSystemUnusualReason
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : E_NOT_OK/E_OK
** Description      : pmic TLF35584 get system unusual reason.
***********************************************************************************************************************/
extern  Std_ReturnType  Gp_TLF35584_GetSystemUnusualReason(uint8* ColdStart_pu8, uint8* Rst_pu8, uint8* WkSource_pu8);
#endif

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_Bist
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : all TLF35584 BIST include FWD,WWD,ABIST and ERR PIN BIST
** 1 Suggest user Call Gp_TLF35584_Bist function only when cold powerOn
** 2 Suggest user apply retry logic,when BIST return not OK, call Gp_TLF35584_Bist again
** at proper position
** This will reduce the risk of SPI transient interference or voltage turbulence when BIST
***********************************************************************************************************************/
extern  Std_ReturnType  Gp_TLF35584_Bist(void);

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_SetDevMpsMode
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : None
** Parameter[in]    : uint8 MpsMode_u8
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : Std_ReturnType
** Description      : set TLF35584 device in test mode or normal mode.
**                  MpsMode_u8 = GP_TLF35584_MPS_NORMALMODE device in normal mode,error will cause ROT reset,
**                  MpsMode_u8 = GP_TLF35584_MPS_TESTMODE device in test mode,will mask WDG/ERR pin reset action
***********************************************************************************************************************/
void Gp_TLF35584_SetDevMpsMode(uint8 MpsMode_u8);

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_SetWkUpTimer
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 WkUpEn_u8:0--disable Timer;1--enable timer
**                    uint32 Ticks_u32: per tick = 10ms,max threshold is 24bit
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Set wake up timer enable or disable and it's wake up period
***********************************************************************************************************************/
extern Std_ReturnType Gp_TLF35584_SetWkUpTimer(uint8 WkUpEn_u8,uint32 Ticks_u32);

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_SetWdgTriggerCondition
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : None
** Parameter[in]    : uint16 TimeOut_u16
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : called by user to set WDG on or off,make sure to call this function before main function
**                   if you care about WDG in your system
***********************************************************************************************************************/
extern void Gp_TLF35584_SetWdgTriggerCondition(uint16 TimeOut_u16);

#endif /* GP_TLF35584_H_ */
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


