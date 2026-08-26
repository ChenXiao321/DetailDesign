/***********************************************************************************************************************
**--------------------------------------------------------------------------------------------------------------------**
** Copyright (c) 2022 by G-Pulse.       All rights reserved.
** This software is copyright protected and proprietary to G-Pulse.
** G-Pulse grants to you only those rights as set out in the license conditions.
** All other rights remain with G-Pulse.
**--------------------------------------------------------------------------------------------------------------------**
**
* Administrative Information
* $Namespace_: ..\ Gp_TLF35584$
* $Class_____: C$
* $Name______: Gp_TLF35584_Callout.c$
* $ArVeri____: 5$
* $FcVeri____: 0.2$
* $Author____: guowanchao$
*
* $Configuration or generate Date,Time: 13:39 . 2022/8/12 $
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: Yes
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_TLF35584 driver callout source file
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Other Header File Inclusion                                                   **
***********************************************************************************************************************/
#include "Gp_TLF35584_Callout.h"
#include "Gp_TimeCal.h"
#include "Spi.h"
#include "Dio.h"
#include "Os.h"
#include "EPS2472_Proj_Cfg.h"

/***********************************************************************************************************************
**                                            Macro Definition                                                        **
***********************************************************************************************************************/
#if (EPS2472_PROJ_SEL == EPS2472_PROJ_SFCM)
#define GP_TLF35584_QSPI_CHANNEL_INDEX          SpiConf_SpiChannel_SpiChannel_DO_SPI4_SLSO1_35584_ECU2
#define GP_TLF35584_QSPI_SEQUENCE_INDEX         SpiConf_SpiSequence_SpiSequence_DO_SPI4_SLSO1_35584_ECU2
#define GP_TLF35584_DIO_SS1                     DioConf_DioChannel_DI_35584_SS1_ECU2
#define GP_TLF35584_DIO_MPS                     DioConf_DioChannel_DO_35584_MPS_ECU2
#else
#define GP_TLF35584_QSPI_CHANNEL_INDEX          SpiConf_SpiChannel_SpiChannel_DO_SPI4_SLSO1_35584_ECU1
#define GP_TLF35584_QSPI_SEQUENCE_INDEX         SpiConf_SpiSequence_SpiSequence_DO_SPI4_SLSO1_35584_ECU1
#define GP_TLF35584_DIO_SS1                     DioConf_DioChannel_DI_35584_SS1_ECU1
#define GP_TLF35584_DIO_MPS                     DioConf_DioChannel_DO_35584_MPS_ECU1
#endif

/***********************************************************************************************************************
**                                           Typedef Definition                                                       **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Static Local Variables Definition                                             **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                                      Static Local Function Declaration                                             **
***********************************************************************************************************************/
#define GP_TLF35584_CODE_START
#include "Gp_TLF35584_MemMap.h"

#define GP_TLF35584_CODE_STOP
#include "Gp_TLF35584_MemMap.h"

/***********************************************************************************************************************
**                                            Function Source Code                                                    **
***********************************************************************************************************************/
#define GP_TLF35584_CODE_START
#include "Gp_TLF35584_MemMap.h"
/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_CalloutDemReport
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 FaultId_u8: ID of TLF35584's fault
**                  : uint8 Status_u8:  status of TLF35584's fault
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Updated to use DEM Events from FaultMatrix-UDS service instead of the deprecated ones
***********************************************************************************************************************/
void    Gp_TLF35584_CalloutDemReport(uint8 FaultId_u8, uint8 Status_u8)
{
    /* Dem_ReportErrorStatus(FaultId_u8, Status_u8); */
}

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_CalloutSpiTransSync
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint16 *TxBuf_pu16
**                  : uint16 *RxBuf_pu16
**                  : uint16 Length_u16
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : Setup function for SPI driver to specify Write and Read buffer
***********************************************************************************************************************/
Std_ReturnType  Gp_TLF35584_CalloutSpiTransSync(uint16 *TxBuf_pu16, uint16 *RxBuf_pu16, uint16 Length_u16)
{
    Std_ReturnType  Return_u8 = E_NOT_OK;

    Return_u8 = Spi_SetupEB(GP_TLF35584_QSPI_CHANNEL_INDEX,\
            (const Spi_DataBufferType *)TxBuf_pu16, (Spi_DataBufferType *)RxBuf_pu16, Length_u16);

    if (Return_u8 == E_OK)
    {
        Return_u8 = Spi_SyncTransmit(GP_TLF35584_QSPI_SEQUENCE_INDEX);
    }
    else
    {
        /*do nothing*/
    }

    return (Return_u8);
}

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_StmSwDalayNus
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint32 Nus_u32
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : None
** Description      : Gp_TLF35584_StmSwDalayNus
***********************************************************************************************************************/
void    Gp_TLF35584_CalloutStmSwDalayNus(uint32 Nus_u32)
{
    Gp_TimeCal_DelayNus(Nus_u32);
}

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_SS1SS2SingnalConfirm
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : E_NOT_OK:the system not in safe state
**                  : E_OK:the system not in safe state
** Description      : SS1 SS2 signal confirm
***********************************************************************************************************************/
Std_ReturnType  Gp_TLF35584_CalloutSafeStateConfirm(void)
{
    Std_ReturnType  Return_u8 = E_NOT_OK;
    uint8 Ss1Level_u8 = 0U;

    Ss1Level_u8 = Dio_ReadChannel(GP_TLF35584_DIO_SS1);

    if (Ss1Level_u8 == 0U)
    {
        Return_u8 = E_OK;
    }

    return (Return_u8);
}

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_CalloutWdiService
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 Lvl_u8
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : TLF35584 wwd wdi service
***********************************************************************************************************************/
void    Gp_TLF35584_CalloutWdiService(uint8 Lvl_u8)
{

}

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_CalloutMpsTestSupport
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : uint8 Lvl_u8
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : The TLF35584 offers a microcontroller programming support feature, that can be used to
** avoid periodic reset
**                  : MPS-high: TLF35584 is in test mode.
**                  : MPS-low: TLF35584 is in normal mode.
***********************************************************************************************************************/
void    Gp_TLF35584_CalloutMpsTestSupport(uint8 Lvl_u8)
{
    Dio_WriteChannel(GP_TLF35584_DIO_MPS, Lvl_u8);
}

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_CalloutWkSourceConfirm
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : wake up source confirm in power off phase
***********************************************************************************************************************/
Std_ReturnType  Gp_TLF35584_CalloutWkSourceConfirm(void)
{
    Std_ReturnType  Return_u8 = E_NOT_OK;

    return (Return_u8);
}

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_CalloutDisableIntrrupt
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : disable global interrupt
***********************************************************************************************************************/
void Gp_TLF35584_CalloutDisableIntrrupt(void)
{
    SuspendAllInterrupts();
}

/***********************************************************************************************************************
** Function Name    : Gp_TLF35584_CalloutEableIntrrupt
** Service ID       : None
** Sync/Async       : Synchronous
** Reentrancy       : Non_Reentrancy
** Parameter[in]    : None
** Parameter[inout] : None
** Parameter[out]   : None
** Return Value     : void
** Description      : enable global interrupt
***********************************************************************************************************************/
void Gp_TLF35584_CalloutEableIntrrupt(void)
{
    ResumeAllInterrupts();
}

#define GP_TLF35584_CODE_STOP
#include "Gp_TLF35584_MemMap.h"
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
***********************************************************************************************************************/


