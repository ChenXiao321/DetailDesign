/***********************************************************************************************************************
**--------------------------------------------------------------------------------------------------------------------**
** Copyright (c) 2022 by G-Pulse.		All rights reserved.
** This software is copyright protected and proprietary to G-Pulse.
** G-Pulse grants to you only those rights as set out in the license conditions.
** All other rights remain with G-Pulse.
**--------------------------------------------------------------------------------------------------------------------**
**
* Administrative Information
* $Namespace_: ..\ Gp_TLF35584$
* $Class_____: C$
* $Name______: Gp_TLF35584.c$
* $ArVeri____: 5$
* $FcVeri____: 0.3$
* $Author____: GWC$
**
**--------------------------------------------------------------------------------------------------------------------**
** MAY BE CHANGED BY USER [Yes/No]: No
**--------------------------------------------------------------------------------------------------------------------**
** DESCRIPTION:
** Gp_TLF35584 driver source file
***********************************************************************************************************************/

/***********************************************************************************************************************
**                        				Other Header File Inclusion                    								  **
***********************************************************************************************************************/
#include "Gp_TLF35584.h"
#include "Gp_TLF35584_Callout.h"
#include "Ifx_reg.h"
/***********************************************************************************************************************
**                        					  Macro Definition                        								  **
***********************************************************************************************************************/
/*GP_TLF35584 wake up mask*/
#define GP_TLF35584_WAKE_UP_MASK				((uint8)0x1FU)
/*WAK mask*/
#define GP_TLF35584_WAK_MASK					((uint8)0x01U)
/*ENA mask*/
#define GP_TLF35584_ENA_MASK  					((uint8)0x02U)
/*QUC mask*/
#define GP_TLF35584_QUC_MASK					((uint8)0x04U)
/*TIMER mask*/
#define GP_TLF35584_TIMER_MASK 					((uint8)0x08U)
/*SPI mask*/
#define GP_TLF35584_SPI_MASK 					((uint8)0x10U)

/*wake-up flag invalid*/
#define GP_TLF35584_WAK_FLAG_INVALID			((uint8)0x00U)
/*WAK wake-up flag valid*/
#define GP_TLF35584_WAK_FLAG					((uint8)0x01U)
/*ENA wake-up flag valid*/
#define GP_TLF35584_ENA_FLAG  					((uint8)0x02U)
/*QUC wake-up flag valid*/
#define GP_TLF35584_QUC_FLAG					((uint8)0x03U)
/*TIMER wake-up flag valid*/
#define GP_TLF35584_TIMER_FLAG 					((uint8)0x04U)
/*SPI wake-up flag valid*/
#define GP_TLF35584_SPI_FLAG 					((uint8)0x05U)

/*GP_TLF35584 reset mask*/
#define GP_TLF35584_PORST_REASON_MASK			((uint8)0xFCU)
/*UC-UV reset mask*/
#define GP_TLF35584_PORST_UCUV_MASK				((uint8)0x02U)
/*STB-UV reset mask*/
#define GP_TLF35584_PORST_STBYUV_MASK			((uint8)0x04U)
/*UC-UV reset*/
#define GP_TLF35584_PORST_REASON_UCUV			((uint8)0x01U)
/*STB-UV reset*/
#define GP_TLF35584_PORST_REASON_STBYUV			((uint8)0x02U)
/*FWD password table buffer numbers*/
#define GP_TLF35584_PASSWORD_TABLE_NUM			((uint8)16U)

/*GP_TLF35584 power on mask*/
#define GP_TLF35584_COLD_ON_MASK				((uint16)0x07U)
/*GP_TLF35584 power on flag*/
#define GP_TLF35584_COLD_ON_FLAG				((uint16)0x06U)

/*Bist function*/
#define GP_TLF35584_BIST_SUCCEED				((uint8)0x50U)
#define GP_TLF35584_UCOV_SELECT0 				((uint8)0x02U)
#define GP_TLF35584_UCOV_MONSF1					((uint8)0x02U)
#define GP_TLF35584_FULLPATH_BIST				((uint8)0x07U)
#define	GP_TLF35584_ABIST_CTRL1_OV 				((uint8)0x01U)
#define	GP_TLF35584_ABIST_CTRL1_CLOCK			((uint8)0x03U)
#define GP_TLF35584_ABIST_CTRL1_DISABLE 		((uint8)0x0U)
#define	GP_TLF35584_SAFETY_ABIST_CTRL0			((uint8)0x03U)
/*bist delay time*/
#define	GP_TLF35584_BIST_DELAY_250				((uint32)250U)
#define	GP_TLF35584_BIST_DELAY_50				((uint32)50U)
#define	GP_TLF35584_BIST_DELAY_1000				((uint32)1000U)

/*function description*/
#define GP_TLF35584_DISABLE_WDG_ERRPIN			((uint8)0x00U)
#define GP_TLF35584_UNLOCK_SEQU0 				((uint8)0xABU)
#define	GP_TLF35584_UNLOCK_SEQU1 				((uint8)0xEFU)
#define GP_TLF35584_UNLOCK_SEQU2 				((uint8)0x56U)
#define GP_TLF35584_UNLOCK_SEQU3 				((uint8)0x12U)
#define GP_TLF35584_LOCK_SEQU0	  				((uint8)0xDFU)
#define GP_TLF35584_LOCK_SEQU1	  				((uint8)0x34U)
#define GP_TLF35584_LOCK_SEQU2	  				((uint8)0xBEU)
#define GP_TLF35584_LOCK_SEQU3   				((uint8)0xCAU)
#define GP_TLF35584_DEVICESTATE_MASK			((uint8)0x07U)
#define GP_TLF35584_FWDSEVICE_FIRST				((uint32)0xFF000000U)
#define GP_TLF35584_FWDSEVICE_SECOND			((uint32)0x00FF0000U)
#define GP_TLF35584_FWDSEVICE_THIRD				((uint32)0x0000FF00U)
#define GP_TLF35584_FWDSEVICE_FORTH				((uint32)0x000000FFU)
#define GP_TLF35584_FIRSTCODE					((uint8)24U)
#define GP_TLF35584_SECONDCODE					((uint8)16U)
#define GP_TLF35584_THIRDCODE					((uint8)8U)
#define GP_TLF35584_FORTHCODE					((uint8)0U)
#define GP_TLF35584_FWDQUESTMASK        		((uint8)0x0FU)
#define GP_TLF35584_FWDRSPMASK        			((uint8)0x30U)
#define GP_TLF35584_FWDERRCNT_MASK      		((uint8)0x0FU)
#define GP_TLF35584_WWDERRCNT_MASK      		((uint8)0x0FU)
#define GP_TLF35584_WWDSCMDMASK      			((uint8)0x01U)
#define GP_TLF35584_FAULT_CLRMASK      			((uint8)0xFFU)
#define GP_TLF35584_RSP0						((uint8)0U)
#define GP_TLF35584_RSP1						((uint8)1U)
#define GP_TLF35584_RSP2						((uint8)2U)
#define GP_TLF35584_RSP3						((uint8)3U)
#define GP_TLF35584_SEED_NOTVALID      			((uint8)0xFFU)
#define GP_TLF35584_STANDBY_STATEM				(0xFCU)


/*reset reason*/
/*:		7			6			5		4		3		2		1		0
:	Hard reset 	 Soft reset	   ERRF	   FWDF	   WWDF	  VMONF	  STBYUV   UCUV
*/
#define	GP_TLF35584_RESET_UCUV					((uint8)0x01U)
#define	GP_TLF35584_RESET_STBYUV				((uint8)0x02U)
#define	GP_TLF35584_RESET_VMONF					((uint8)0x04U)
#define	GP_TLF35584_RESET_WWDF					((uint8)0x08U)
#define	GP_TLF35584_RESET_FWDF					((uint8)0x10U)
#define	GP_TLF35584_RESET_ERRF					((uint8)0x20U)
#define	GP_TLF35584_RESET_SR					((uint8)0x40U)
#define	GP_TLF35584_RESET_HR					((uint8)0x80U)

#define	GP_TLF35584_BIST_ERROR_0				((uint32)0x00000001U)
#define	GP_TLF35584_BIST_ERROR_1				((uint32)0x00000002U)
#define	GP_TLF35584_BIST_ERROR_2				((uint32)0x00000004U)
#define	GP_TLF35584_BIST_ERROR_3				((uint32)0x00000008U)
#define	GP_TLF35584_BIST_ERROR_4				((uint32)0x00000010U)
#define	GP_TLF35584_BIST_ERROR_5				((uint32)0x00000020U)
#define	GP_TLF35584_BIST_ERROR_6				((uint32)0x00000040U)
#define	GP_TLF35584_BIST_ERROR_7				((uint32)0x00000080U)
#define	GP_TLF35584_BIST_ERROR_8				((uint32)0x00000100U)
#define	GP_TLF35584_BIST_ERROR_9				((uint32)0x00000200U)
#define	GP_TLF35584_BIST_ERROR_10				((uint32)0x00000400U)
#define	GP_TLF35584_BIST_ERROR_11				((uint32)0x00000800U)
#define	GP_TLF35584_BIST_ERROR_12				((uint32)0x00001000U)
#define	GP_TLF35584_BIST_ERROR_13				((uint32)0x00002000U)
#define	GP_TLF35584_BIST_ERROR_14				((uint32)0x00004000U)
#define	GP_TLF35584_BIST_ERROR_15				((uint32)0x00008000U)
#define	GP_TLF35584_BIST_ERROR_16				((uint32)0x00010000U)
#define	GP_TLF35584_BIST_ERROR_17				((uint32)0x00020000U)

#define GP_TLF35584_WRITE_COMMAND				((uint16)0x4000U)
#define	GP_TLF35584_FWD_ERR_ANSWER				((uint8)0x1U)

#define GP_TLF35584_TIMER_THRESHOULD			((uint32)0x1000000U)

#define GP_TLF35584_GETRST_DIAG					((uint8)0x1U)
#define GP_TLF35584_GETRST_RUN					((uint8)0x2U)
/*BIST parameter*/
#define GP_TLF35584_ABIST_SINGLE_MAXTIME		((uint32)400U)
#define GP_TLF35584_ABIST_MULTI_MAXTIME			((uint32)2000U)
/***********************************************************************************************************************
**                        					 Typedef Definition                        								  **
***********************************************************************************************************************/

/***********************************************************************************************************************
**                   					Static Local Variables Definition    						          		  **
***********************************************************************************************************************/
#define GP_TLF35584_CLEAR_FAR_DATA_ALIGN4_START
#include "Gp_TLF35584_MemMap.h"
GP_TLF35584_STATIC_ Gp_TLF35584_AllDataType	Gp_TLF35584_rtData_ltst;
GP_TLF35584_STATIC_	uint8 Gp_TLF35584_idxFlagRegValue_lau8[GP_TLF35584_FLAG_REG_NUM];
GP_TLF35584_STATIC_	uint8 Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_STATUS_REG_NUM];
GP_TLF35584_STATIC_	uint8 Gp_TLF35584_BistErrRestore_lau8[11];
GP_TLF35584_STATIC_ Gp_TimeCalType Gp_TLF35584_SingAnalogBistCal_lst;
GP_TLF35584_STATIC_ Gp_TimeCalType Gp_TLF35584_MultiAnalogBistCal_lst;
#define GP_TLF35584_CLEAR_FAR_DATA_ALIGN4_STOP
#include "Gp_TLF35584_MemMap.h"

#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_START
#include "Gp_TLF35584_MemMap.h"
GP_TLF35584_STATIC_	const	uint32	Gp_TLF35584_idxResTable_lcau32[GP_TLF35584_PASSWORD_TABLE_NUM] =
{
	0xFF0FF000U,
	0xB040BF4FU,
	0xE919E616U,
	0xA656A959U,
	0x75857A8AU,
	0x3ACA35C5U,
	0x63936C9CU,
	0x2CDC23D3U,
	0xD222DD2DU,
	0x9D6D9262U,
	0xC434CB3BU,
	0x8B7B8474U,
	0x58A857A7U,
	0x17E718E8U,
	0x4EBE41B1U,
	0x01F10EFEU,
};

/*init register address*/
GP_TLF35584_STATIC_	const uint8 Gp_TLF35584_idxInitRegAddress_cau8[GP_TLF35584_INIT_REG_NUM] =
{
	GP_TLF35584_REG_DEVCFG0,
	GP_TLF35584_REG_DEVCFG2,
	GP_TLF35584_REG_SYSPCFG0,
	GP_TLF35584_REG_SYSPCFG1,
	GP_TLF35584_REG_WDCFG0,
	GP_TLF35584_REG_WDCFG1,
	GP_TLF35584_REG_FWDCFG,
	GP_TLF35584_REG_WWDCFG0,
	GP_TLF35584_REG_WWDCFG1,
	GP_TLF35584_REG_DEVCTRL,
	GP_TLF35584_REG_DEVCTRLN,
	GP_TLF35584_REG_BCK_FREQ_CHANGE,
	GP_TLF35584_REG_BCK_FRE_SPREAD,
	GP_TLF35584_REG_BCK_MAIN_CTRL,
	GP_TLF35584_REG_WKTIMCFG0,
	GP_TLF35584_REG_WKTIMCFG1,
	GP_TLF35584_REG_WKTIMCFG2,
};

/*flag register address*/
GP_TLF35584_STATIC_	const uint8 Gp_TLF35584_idxFlagRegAddress_cau8[GP_TLF35584_FLAG_REG_NUM] =
{
	GP_TLF35584_REG_INITERR,
	GP_TLF35584_REG_IF,
	GP_TLF35584_REG_SYSSF,
	GP_TLF35584_REG_WKSF,
	GP_TLF35584_REG_SPISF,
	GP_TLF35584_REG_SYSFAIL,
	GP_TLF35584_REG_MONSF0,
	GP_TLF35584_REG_MONSF1,
	GP_TLF35584_REG_MONSF2,
	GP_TLF35584_REG_MONSF3,
	GP_TLF35584_REG_OTFAIL,
	GP_TLF35584_REG_OTWRNSF,
};
/*status register address*/
GP_TLF35584_STATIC_	const uint8 Gp_TLF35584_idxStatusRegAddress_cau8[GP_TLF35584_STATUS_REG_NUM] =
{
	GP_TLF35584_REG_VMONSTAT,
	GP_TLF35584_REG_DEVSTAT,
	GP_TLF35584_REG_PROTSTAT,
	GP_TLF35584_REG_WWDSTAT,
	GP_TLF35584_REG_FWDSTAT0,
	GP_TLF35584_REG_FWDSTAT1,
	GP_TLF35584_REG_RSYSPCFG0,
	GP_TLF35584_REG_RSYSPCFG1,
	GP_TLF35584_REG_RWDCFG0,
	GP_TLF35584_REG_RWDCFG1,
	GP_TLF35584_REG_RFWDCFG,
	GP_TLF35584_REG_RWWDCFG0,
	GP_TLF35584_REG_RWWDCFG1,
	GP_TLF35584_REG_WWDSCMD,
};

#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_STOP
#include "Gp_TLF35584_MemMap.h"

/***********************************************************************************************************************
**                  					   Global Variables Definition            						  		      **
***********************************************************************************************************************/
#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_START
#include "Gp_TLF35584_MemMap.h"
const	uint32	Gp_TLF35584_adrDataRec_vcau32[4U] =
{
		(uint32)&Gp_TLF35584_rtData_ltst.ErrData_tst.BistErrPath_u32,
		(uint32)&Gp_TLF35584_BistErrRestore_lau8[0U], /*size 11*/
		(uint32)&Gp_TLF35584_idxFlagRegValue_lau8[0U],	/*size 12*/
		(uint32)&Gp_TLF35584_idxStatusRegValue_lau8[0U]	/*size 14*/
};
#define GP_TLF35584_CONST_FAR_DATA_ALIGN4_STOP
#include "Gp_TLF35584_MemMap.h"

/***********************************************************************************************************************
**                						Static Local Function Declaration    					        		      **
***********************************************************************************************************************/
#define GP_TLF35584_CODE_START
#include "Gp_TLF35584_MemMap.h"

GP_TLF35584_STATIC_	uint16	Gp_TLF35584_WriteCmd(uint8 RegAdd_u8, uint8 RegData_u8);
GP_TLF35584_STATIC_	uint16	Gp_TLF35584_ReadCmd(uint8 RegData_u8);
Gp_TLF35584_INLINE_	void	Gp_TLF35584_UnlockSeq(void);
Gp_TLF35584_INLINE_	void	Gp_TLF35584_LockSeq(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_WwdSpiService(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_WwdWdiService(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_FwdSpiService(uint8 UsedSeed_u8);
GP_TLF35584_STATIC_	void	Gp_TLF35584_GetState(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_WdgService(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_GetWdgInfo(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_SwitchToStandbyMode(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_DisableWdgFsp(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_RtWdgRegCfg(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_InitRegCfg(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_ClearFlagReg(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_GetAllFaultRegister(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_TransmitData(uint16 TxCnt_u16);
GP_TLF35584_STATIC_ void	Gp_TLF35584_SwitchToNormalMode(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_GetResetType(uint8 phase_u8);
GP_TLF35584_STATIC_	void	Gp_TLF35584_ColdStartAndPorst(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_PreInit(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_UpdateFlagReg(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_UpdateStatusReg(void);
GP_TLF35584_STATIC_	void	Gp_TLF35584_WrongService(uint8 WrongSlect_u8);
GP_TLF35584_STATIC_ void	Gp_TLF35584_SetPorstMode(uint8 ResetSlect_u8);
GP_TLF35584_STATIC_ void	Gp_TLF35584_RtSetMode(void);
#if(GP_TLF35584_DRIVER_USED_FOR == GP_TLF35584_USED_FOR_APP)
GP_TLF35584_STATIC_	void	Gp_TLF35584_GetWakeUpSource(void);
GP_TLF35584_STATIC_	void Gp_TLF35584_GetWakeAndResetInfo(void);
#endif
#if(GP_TLF35584_FWD_BIST_ENABLE == STD_ON)
GP_TLF35584_STATIC_ void	Gp_TLF35584_FwdBist(void);
#endif
#if(GP_TLF35584_WWD_BIST_ENABLE == STD_ON)
GP_TLF35584_STATIC_ void	Gp_TLF35584_WwdBist(void);
#endif
#if(GP_TLF35584_ERR_BIST_ENABLE == STD_ON)
GP_TLF35584_STATIC_	void	Gp_TLF35584_Errpin_Bist (void);
#endif
#if(GP_TLF35584_ANA_BIST_ENABLE == STD_ON)
GP_TLF35584_STATIC_	Std_ReturnType	Gp_TLF35584_SinSafetyBistCheck(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_SingleOvSafetyPathBist(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_SafetypathBist (void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_AllCompartorSafetyCmd(void);
GP_TLF35584_STATIC_	Std_ReturnType	Gp_TLF35584_AllSafetyBistCheck(void);
GP_TLF35584_STATIC_ void	Gp_TLF35584_AllCompartorSafetyPathBist(void);
#endif
#define GP_TLF35584_CODE_STOP
#include "Gp_TLF35584_MemMap.h"

/***********************************************************************************************************************
**                 							  Function Source Code          					  		              **
***********************************************************************************************************************/
#define GP_TLF35584_CODE_START
#include "Gp_TLF35584_MemMap.h"

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_Init
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: void
** Description		: TLF35584 init function,include watchdog initialization
err pin initialization, power regulators initialization, and sets the initial value of the state variable
***********************************************************************************************************************/
void	Gp_TLF35584_Init(void)
{
	/*
	 * 5Mhz: 	523us
	 * 8.33Mhz:	439us
	 * */
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;

	if (Data_pst->StatusData_tst.BistFunctCalled_u8 == FALSE)
	{
		/*pre-init TLF35584*/
		Gp_TLF35584_PreInit();
		/*get reset and wakeup info*/
		Gp_TLF35584_GetWakeAndResetInfo();
	}
	else
	{
		/*for MISERA*/
	}

	/*Get state*/
	Gp_TLF35584_GetState();
	/*To solve problem that when soft reset time haven't lead TLF35584 to init mode,but WGD err cnt is not zero.
	 * This situation will reduce WDG overflow tolerance*/
	if (Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE)
	{
		Gp_TLF35584_SetDevMpsMode(GP_TLF35584_MPS_TESTMODE);
		Gp_TLF35584_SetPorstMode(0);
		Gp_TLF35584_SetDevMpsMode(GP_TLF35584_MPS_NORMALMODE);
	}
	else
	{
		/*for MISERA*/
	}
	/*get watch dog information*/
	Gp_TLF35584_GetWdgInfo();
	/*service wwd to exit long open window mode*/
	Gp_TLF35584_WwdSpiService();
	/*before configure register,disable WDG and FSP to prevent malfunction */
	Gp_TLF35584_DisableWdgFsp();
	/*all register init*/
	Gp_TLF35584_InitRegCfg();
	/*Get state*/
	Gp_TLF35584_GetState();
	/*If device state is INIT*/
	if(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_INIT_STATE)
	{
		Data_pst->StatusData_tst.InitStatus_u8 = GP_TLF35584_PASS;
		Data_pst->ErrData_tst.DriverErrPath_u32 &= (~GP_TLF35584_INIT_ERR);
	}
	else
	{
		/*for misra c*/
		Data_pst->StatusData_tst.InitStatus_u8 = GP_TLF35584_FAILED;
		Data_pst->ErrData_tst.DriverErrPath_u32 |= GP_TLF35584_INIT_ERR;
		#if(GP_TLF35584_DEM_ERROR_ENABLE == GP_TLF35584_ENABLE)
		Gp_TLF35584_CalloutDemReport(GP_TLF35584_REINIT_FAULT, GP_TLF35584_FAILED);
		#endif
	}
	/*wait for user to switch normal*/
	Data_pst->StatusData_tst.StateVar_u8 = GP_TLF35584_WAIT_STATE;
	Data_pst->WdgSwitch_b = FALSE;
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_MainFunction
** Service ID		: None
** Sync/Async		: Asynchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: void
** Description		: TLF35584 main state,service wdg,get wdg infomation,update err infomation
***********************************************************************************************************************/
void	Gp_TLF35584_MainFunction(void)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;
	/*Set TLF35584 mode Async*/
	Gp_TLF35584_RtSetMode();
	/*Read and store all fault registers*/
	Gp_TLF35584_GetAllFaultRegister();
	switch(Data_pst->StatusData_tst.StateVar_u8)
	{
		case GP_TLF35584_PREPARERUN_STATE:
		{
			/*Change WDCYC from 1ms-0.1ms and Re enable WDG to rebuild WWD sequence*/
			Gp_TLF35584_RtWdgRegCfg();
			Gp_TLF35584_GetWdgInfo();
			/*After Re enable WDG,feed WDG once*/
			Gp_TLF35584_WdgService();
			Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_CMD_SYNC_DELAY);
			Gp_TLF35584_SwitchToNormalMode();
			Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
			Gp_TLF35584_GetState();

			if(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE)
			{
				Data_pst->StatusData_tst.StateVar_u8 = GP_TLF35584_RUN_STATE;
				break;
			}
			else
			{
				if(Data_pst->ReInitRetry_u8 < GP_TLF35584_TRY_REINIT_MAX)
				{
					Data_pst->ReInitRetry_u8++;
					Data_pst->StatusData_tst.StateVar_u8 = GP_TLF35584_PREPARERUN_STATE;
				}else
				{
					Data_pst->StatusData_tst.StateVar_u8 = GP_TLF35584_ERROR_STATE;
				}
			}
			break;
		}
		case GP_TLF35584_RUN_STATE:
		{
			Data_pst->WdgTimeCnt_u16++;
			if(Data_pst->WdgTimeCnt_u16 == GP_TLF35584_SERVICE_WDG_TIME)
			{
				Data_pst->WdgTimeCnt_u16 = 0U;
				#if(GP_TLF35584_WDGM_ENABLE == GP_TLF35584_ENABLE)
				if(Data_pst->WdgSwitch_b == TRUE)
				{
					if(Data_pst->WdgMTrigCnt_u16 > 0)
					{
						Data_pst->WdgMTrigCnt_u16--;
					}else
					{
						Data_pst->WdgSwitch_b = FALSE;
					}
					Gp_TLF35584_WdgService();
				}
				else
				{
					/*for misra c*/
				}
				#elif(GP_TLF35584_WDGM_ENABLE == GP_TLF35584_DISABLE)
				{
					Gp_TLF35584_WdgService();
				}
				#endif

				/*because of PRERUN step to RUN step time over 40ms,will cause a WDG err event*/
				if(Data_pst->ClearFirstWdgEventFlg_b == 0U)
				{
					Gp_TLF35584_ClearFlagReg();
					Data_pst->ClearFirstWdgEventFlg_b = 0x5AU;
				}
				else
				{
					/*for MISERA*/
				}
			}
			else
			{
				Gp_TLF35584_GetWdgInfo();
			}
			break;
		}
		case GP_TLF35584_WAIT_STATE:
		{
			/*after initial,wait for user to give switch to normal command*/
			break;
		}
		case GP_TLF35584_ERROR_STATE:
		{
			break;
		}
		default:
		{
			Data_pst->StatusData_tst.StateVar_u8 = GP_TLF35584_PREPARERUN_STATE;
			break;
		}
	}

}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SetWdgSwitch
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: None
** Parameter[in]	: uint16 TimeOut_u16
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: called by user to set WDG on or off,make sure to call this function before main function
** 					 if you care about WDG in your system
***********************************************************************************************************************/
void Gp_TLF35584_SetWdgTriggerCondition(uint16 TimeOut_u16)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;

	Data_pst->WdgMTrigCnt_u16 = TimeOut_u16;

	if(Data_pst->WdgMTrigCnt_u16 > 0U)
	{
		/*service WDG*/
		Data_pst->WdgSwitch_b = TRUE;
	}else
	{
		/*don't service WDG*/
		Data_pst->WdgSwitch_b = FALSE;
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetDevSigModeIn
** Service ID		: None
** Sync/Async		: Asynchronous
** Reentrancy		: None
** Parameter[in]	: uint16 Id_u16
** Parameter[inout]	: None
** Parameter[out]	: uint8* DevMode_pu8
** Return Value		: Std_ReturnType
** Description		: get device state
***********************************************************************************************************************/
Std_ReturnType	Gp_TLF35584_GetDevSigModeIn(uint16 Id_u16, uint8* DevMode_pu8)
{
	Gp_TLF35584_AllDataType *Data_pst 	= &Gp_TLF35584_rtData_ltst;
	Std_ReturnType Ret_t = E_NOT_OK;

	GP_TLF35584_UNUSED_PARAMETER(Id_u16);
	if(DevMode_pu8 != GP_TLF35584_NULL_PTR)
	{
		Ret_t = E_OK;
		*DevMode_pu8 = Data_pst->StatusData_tst.DeviceState_u8;
	}
	else
	{
		Ret_t = E_NOT_OK;
	}
    return (Ret_t);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SetDevSigModeOut
** Service ID		: None
** Sync/Async		: Asynchronous
** Reentrancy		: None
** Parameter[in]	: uint16 Id_u16
** Parameter[in]	: uint8 DevMode_u8
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: Std_ReturnType
** Description		: set TLF35584 device mode
***********************************************************************************************************************/
Std_ReturnType	Gp_TLF35584_SetDevSigModeOut(uint16 Id_u16, uint8 DevMode_u8)
{
	Gp_TLF35584_AllDataType *Data_pst 	= &Gp_TLF35584_rtData_ltst;
	Std_ReturnType Ret_t = E_NOT_OK;

	GP_TLF35584_UNUSED_PARAMETER(Id_u16);

	if(DevMode_u8 <= GP_TLF35584_WAKE_STATE)
	{
		Ret_t = E_OK;
		if(DevMode_u8 == GP_TLF35584_STANDBY_STATE)
		{
			Data_pst->SetMode_u8 = GP_TLF35584_STANDBY_STATE;
		}
		else if(DevMode_u8 == GP_TLF35584_NORMAL_STATE)
		{
			Data_pst->SetMode_u8 = GP_TLF35584_NORMAL_STATE;
		}
		else if(DevMode_u8 == GP_TLF35584_PORST_STATE)
		{
			Data_pst->SetMode_u8 = GP_TLF35584_PORST_STATE;
		}
		else if(DevMode_u8 == GP_TLF35584_WAKE_STATE)
		{
			Data_pst->SetMode_u8 = GP_TLF35584_WAKE_STATE;
		}
		else
		{
			/*for misra c*/
		}
	}
	else
	{
		Ret_t = E_NOT_OK;
	}
    return (Ret_t);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetDevSigDiag
** Service ID		: None
** Sync/Async		: Asynchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: uint16 Id_u16
** Parameter[inout]	: None
** Parameter[out]	: uint32* DevFault_pu32
** Return Value		: Std_ReturnType
** Description		: get TLF35584 device fault signal
***********************************************************************************************************************/
Std_ReturnType	Gp_TLF35584_GetDevSigDiag(uint16 Id_u16, uint32* DevFault_pu32)
{
	Gp_TLF35584_AllDataType *Data_pst 	= &Gp_TLF35584_rtData_ltst;
	Std_ReturnType Ret_t = E_NOT_OK;

	if((Id_u16 < GP_TLF35584_FAULT_SIGNAL_NUMS) && (DevFault_pu32 != GP_TLF35584_NULL_PTR))
	{
		Ret_t = E_OK;
		*DevFault_pu32 = Data_pst->ErrData_tst.ErrRecord_au32[Id_u16];
	}
	else
	{
		Ret_t = E_NOT_OK;
	}
    return (Ret_t);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_Bist
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: all TLF35584 BIST include FWD,WWD,ABIST and ERR PIN BIST
** 1 Suggest user Call Gp_TLF35584_Bist function only when cold powerOn
** 2 Suggest user apply retry logic,when BIST return not OK,set a global flag,and call Gp_TLF35584_Bist again
** at proper position
** This will reduce the risk of SPI transient interference or voltage turbulence when BIST
***********************************************************************************************************************/
Std_ReturnType	Gp_TLF35584_Bist(void)
{
	Gp_TLF35584_AllDataType	*Data_pst   = &Gp_TLF35584_rtData_ltst;
	Std_ReturnType Ret_t = E_NOT_OK;

	Gp_TLF35584_PreInit();
	Gp_TLF35584_GetWakeAndResetInfo();

	/*BIST Called,so at initial phase don't need to get reset type...*/
	Data_pst->StatusData_tst.BistFunctCalled_u8 = TRUE;
	/*abist*/
	#if(GP_TLF35584_ANA_BIST_ENABLE == GP_TLF35584_ENABLE)

	/*
	 * 5Mhz: 	2151us
	 * 8.33Mhz:	2028us
	 * */
	Gp_TLF35584_SafetypathBist();

	#endif
	/*FWD bist*/
	#if(GP_TLF35584_FWD_BIST_ENABLE == GP_TLF35584_ENABLE)

	/*
	 * 5Mhz: 	1257us
	 * 8.33Mhz:	1144us
	 * */
	Gp_TLF35584_FwdBist();

	#endif
	/*WWD bist*/
	#if(GP_TLF35584_WWD_BIST_ENABLE == GP_TLF35584_ENABLE)

	/*
	 * 5Mhz: 	1389us
	 * 8.33Mhz:	1240us
	 * */
	Gp_TLF35584_WwdBist();
	#endif
	/*Error pin bist*/
	#if(GP_TLF35584_ERR_BIST_ENABLE == GP_TLF35584_ENABLE)
	Gp_TLF35584_Errpin_Bist();
	#endif
	if(Data_pst->ErrData_tst.BistErrPath_u32 > 0U)
	{
		Data_pst->StatusData_tst.BistSuccessful_u8 = GP_TLF35584_FAILED;
	}
	else
	{
		Ret_t = E_OK;
		Data_pst->StatusData_tst.BistSuccessful_u8 = GP_TLF35584_PASS;
	}

	return (Ret_t);
}

#if(GP_TLF35584_DRIVER_USED_FOR == GP_TLF35584_USED_FOR_APP)
/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetWakeAndResetInfo
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: pmic TLF35584 get system unusual reason.
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void Gp_TLF35584_GetWakeAndResetInfo(void)
{
	/*read R0 type register to judge if is cold poweron*/
	/*R0 register will be write to a user defefined value*/
	Gp_TLF35584_ColdStartAndPorst();
	/*read register and get wake up source*/
	Gp_TLF35584_GetWakeUpSource();
	/*Clear fault*/
	Gp_TLF35584_ClearFlagReg();
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetSystemUnusualReason
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: E_NOT_OK/E_OK
** Description		: pmic TLF35584 get system unusual reason.
***********************************************************************************************************************/
Std_ReturnType	Gp_TLF35584_GetSystemUnusualReason(uint8* ColdStart_pu8, uint8* Rst_pu8, uint8* WkSource_pu8)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	Std_ReturnType Ret_t = E_NOT_OK;
	/*
	 	 	Data_pst->StatusData_tst.SystemPor_bk_u8 	= 0		this is not the first power-on
	  						 		= 1		KL30 power on

	 	    Data_pst->StatusData_tst.ResetType_bk_u8
					:				bit7		   bit6		   bit5	     bit4	   bit3		bit2	   bit1	   bit0
					:				Hard reset 	 Soft reset	   ERRF	     FWDF	   WWDF	    VMONF	  STBYUV   UCUV

			Data_pst->StatusData_tst.WakeupSource_bk_u8 = 0	no wake-up source
			Data_pst->StatusData_tst.WakeupSource_bk_u8 = 1	WAK wake-up source
			Data_pst->StatusData_tst.WakeupSource_bk_u8 = 2	ENA wake-up source
			Data_pst->StatusData_tst.WakeupSource_bk_u8 = 3	QUC wake-up source
			Data_pst->StatusData_tst.WakeupSource_bk_u8 = 4	TIMER wake-up source
			Data_pst->StatusData_tst.WakeupSource_bk_u8 = 5	SPI wake-up source
	*/
	if((ColdStart_pu8 != GP_TLF35584_NULL_PTR) && (Rst_pu8 != GP_TLF35584_NULL_PTR) &&\
		(WkSource_pu8 != GP_TLF35584_NULL_PTR))
	{
		Ret_t = E_OK;
		/*copy data*/
		*ColdStart_pu8 = Data_pst->StatusData_tst.SystemPor_bk_u8;
		*Rst_pu8 = Data_pst->StatusData_tst.ResetType_bk_u8;
		*WkSource_pu8 = Data_pst->StatusData_tst.WakeupSource_bk_u8;
	}
	else
	{
		Ret_t = E_NOT_OK;
	}
	return(Ret_t);
}
#endif

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SetDevMpsMode
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: None
** Parameter[in]	: uint8 MpsMode_u8
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: Std_ReturnType
** Description		: set TLF35584 device in test mode or normal mode.
** 					MpsMode_u8 = GP_TLF35584_MPS_NORMALMODE device in normal mode,error will cause ROT reset,
** 					MpsMode_u8 = GP_TLF35584_MPS_TESTMODE device in test mode,will mask WDG/ERR pin etc reset action
***********************************************************************************************************************/
void	Gp_TLF35584_SetDevMpsMode(uint8 MpsMode_u8)
{
	/*set TLF35584 to test mode--don't reset when wdg/err pin etc error detected*/
	Gp_TLF35584_CalloutMpsTestSupport(MpsMode_u8);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_TransmitData
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: uint16 TxCnt_u16
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: void
** Description		: This function trigger the SPI driver to send the frame
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_TransmitData(uint16 TxCnt_u16)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;
	uint32	Index_u32 = 0U;
	uint32	Cnt_u32 = 0U;

	/*Number of read/write failures attempts: GP_TLF35584_WR_TRY_MAX */
	for(Cnt_u32 = 0U; Cnt_u32 < GP_TLF35584_TRY_REPAIR_MAX; Cnt_u32++)
	{
		/*If SPI transmit is OK, check the data validation*/
		if ((Gp_TLF35584_CalloutSpiTransSync(&Data_pst->SpiData_tst.TxBuf_au16[0U],&Data_pst->SpiData_tst.RxBuf_au16[0U],TxCnt_u16)) == (E_OK))
		{
			 Data_pst->StatusData_tst.SpiCheckFlag_u8 = (uint8)GP_TLF35584_NO_ERROR;
			/* Check that all write commands are cycled back correctly: */
			for (Index_u32 = 0U; Index_u32 < TxCnt_u16; Index_u32++)
			{
				/* Current data word is a write command? */
				if ((Data_pst->SpiData_tst.TxBuf_au16[Index_u32] & GP_TLF35584_WRITE_COMMAND) > 0U)
				{
				  /* TX data was echoed back to RX data? */
				  if (Data_pst->SpiData_tst.TxBuf_au16[Index_u32] != Data_pst->SpiData_tst.RxBuf_au16[Index_u32])
				  {
					  /* Recording error*/
					  Data_pst->StatusData_tst.SpiCheckFlag_u8 = (uint8)GP_TLF35584_SPI_ERR;
					  break;
				  }
				  else
				  {
					  /*for misra c*/
				  }
				}
				else
				{
					/*for misra c*/
				}
			}
			/*Check spi error?*/
			if(Data_pst->StatusData_tst.SpiCheckFlag_u8 == (uint8)GP_TLF35584_NO_ERROR)
			{
				Data_pst->ErrData_tst.DriverErrPath_u32 &= (~GP_TLF35584_SPI_ERR);
				break;
			}
			else
			{
				/* Recording error*/
				Data_pst->ErrData_tst.DriverErrPath_u32 |= GP_TLF35584_SPI_ERR;
				#if(GP_TLF35584_DEM_ERROR_ENABLE == GP_TLF35584_ENABLE)
				Gp_TLF35584_CalloutDemReport(GP_TLF35584_SPI_FAULT, GP_TLF35584_FAILED);
				#endif
			}
		}
		else
		{
			/* Recording error*/
			Data_pst->ErrData_tst.DriverErrPath_u32 |= GP_TLF35584_SPI_ERR;
			#if(GP_TLF35584_DEM_ERROR_ENABLE == GP_TLF35584_ENABLE)
			Gp_TLF35584_CalloutDemReport(GP_TLF35584_SPI_FAULT, GP_TLF35584_FAILED);
			#endif
		}
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_WriteCmd
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: uint8 RegAdd_u8,
** Parameter[in]	: uint8 RegData_u8,
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: uint16 RegValue_u16
** Description		: This function for mcu write cmd to TLF35584
***********************************************************************************************************************/
GP_TLF35584_STATIC_	uint16	Gp_TLF35584_WriteCmd(uint8 RegAdd_u8, uint8 RegData_u8)
{
	uint16	RegValue_u16	= 0U;

	RegValue_u16	= (((uint16)(RegAdd_u8) & (uint16)0x3FU)<< 8U);
	/*write command*/
	RegValue_u16	|=	GP_TLF35584_WRITE_COMMAND;
	RegValue_u16	|=	((uint16)(RegData_u8) & (uint16)0xFFU);
	return	(RegValue_u16);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_ReadCmd
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: uint8 RegData_u8,
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: uint16 RegValue_u16
** Description		: This function for mcu read data from TLF35584 register
***********************************************************************************************************************/
GP_TLF35584_STATIC_	uint16	Gp_TLF35584_ReadCmd(uint8 RegData_u8)
{
	/*read command*/
	uint16	RegValue_u16 =  (((uint16)(RegData_u8) & (uint16)0x3FU) << 8U);
	return	(RegValue_u16);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_UnlockSeq
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Protection key register to request write access to protected registers.
Unlock: write 32-bit sequence of 4 consecutive bytes(1: 0xAB 2:0xEF 3:0x56 4:0x12)
to unlock access to protected registers
***********************************************************************************************************************/
Gp_TLF35584_INLINE_	void	Gp_TLF35584_UnlockSeq(void)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;

	/*0xAB*/
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_PROTCFG, GP_TLF35584_UNLOCK_SEQU0);
	/*0xEF*/
	Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_PROTCFG, GP_TLF35584_UNLOCK_SEQU1);
	/*0x56*/
	Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_PROTCFG, GP_TLF35584_UNLOCK_SEQU2);
	/*0x12*/
	Data_pst->SpiData_tst.TxBuf_au16[3U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_PROTCFG, GP_TLF35584_UNLOCK_SEQU3);
	Data_pst->SpiData_tst.CntTx_u16 = 4U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_LockSeq
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Lock: write 32-bit sequence of 4 consecutive bytes
(1: 0xDF 2:0x34 3:0xBE 4:0xCA) to lock access to protected registers. All
configured values are applied to SSC and WD module after the lock
***********************************************************************************************************************/
Gp_TLF35584_INLINE_	void	Gp_TLF35584_LockSeq(void)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;

	/*0xDF*/
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_PROTCFG, GP_TLF35584_LOCK_SEQU0);
	/*0x34*/
	Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_PROTCFG, GP_TLF35584_LOCK_SEQU1);
	/*0xBE*/
	Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_PROTCFG, GP_TLF35584_LOCK_SEQU2);
	/*0xCA*/
	Data_pst->SpiData_tst.TxBuf_au16[3U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_PROTCFG, GP_TLF35584_LOCK_SEQU3);
	Data_pst->SpiData_tst.CntTx_u16 = 4U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_WwdSpiService
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Window watchdog SPI trigger command
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_WwdSpiService(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint8	Scmd_u8 = 0U;
	/*Write the result to the register after xOR*/
	Scmd_u8 = (Data_pst->StatusData_tst.LastWwdScmd_u8 ^ GP_TLF35584_WWDSCMDMASK);
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WWDSCMD, Scmd_u8);
	Data_pst->SpiData_tst.CntTx_u16 = 1U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_WwdWdiService
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: A valid trigger signal is a falling edge from VWDI,high to VWDI,low
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_WwdWdiService(void)
{
	Gp_TLF35584_AllDataType	*Data_pst	= &Gp_TLF35584_rtData_ltst;

	/*Wwd Wdi Service "^"*/
	Data_pst->WdiRestoreFlag_b = TRUE;
	/*Wdi Pull Low */
	Gp_TLF35584_CalloutWdiService(STD_LOW);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_FwdSpiService
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: uint8 UsedSeed_u8
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Write functional watchdog response bytes Write the last functional watchdog response byte to
this field to synchronize/restart the heartbeat.
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_FwdSpiService(uint8 UsedSeed_u8)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;
	uint32					SignTmp_u32 = 0U;
	uint8					Rsp_u8 = 0U;
	uint8 					Rsp_conter = 0U;

	/*get the password*/
	SignTmp_u32 = Gp_TLF35584_idxResTable_lcau32[UsedSeed_u8];
	Rsp_conter = Data_pst->StatusData_tst.RspCnt_u8;

	if(Rsp_conter == 3U)
	{
		/*get the first password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_FIRST) >> GP_TLF35584_FIRSTCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP0] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		/*get the second password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_SECOND) >> GP_TLF35584_SECONDCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP1] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		/*get the third password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_THIRD) >>  GP_TLF35584_THIRDCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP2] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		/*get the fourth password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_FORTH) >>  GP_TLF35584_FORTHCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP3] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSPSYNC, Rsp_u8);
		Data_pst->SpiData_tst.CntTx_u16 = 4U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	}else if(Rsp_conter == 2)
	{
		/*get the first password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_FIRST) >> GP_TLF35584_FIRSTCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP0] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		/*get the second password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_SECOND) >> GP_TLF35584_SECONDCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP1] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		/*get the third password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_THIRD) >>  GP_TLF35584_THIRDCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP2] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		Data_pst->SpiData_tst.CntTx_u16 = 3U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	}else if(Rsp_conter == 1)
	{
		/*get the first password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_FIRST) >> GP_TLF35584_FIRSTCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP0] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		/*get the second password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_SECOND) >> GP_TLF35584_SECONDCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP1] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		Data_pst->SpiData_tst.CntTx_u16 = 2U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	}else if(Rsp_conter == 0)
	{
		/*get the first password*/
		Rsp_u8 = (uint8)((SignTmp_u32 & GP_TLF35584_FWDSEVICE_FIRST) >> GP_TLF35584_FIRSTCODE);
		Data_pst->SpiData_tst.TxBuf_au16[GP_TLF35584_RSP0] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP, Rsp_u8);
		Data_pst->SpiData_tst.CntTx_u16 = 1U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	}else
	{
		/*Unexpected error*/
	}

}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_WrongService
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Implement reset function according to parameters.
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_WrongService(uint8 WrongSlect_u8)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;

	/*FWD reset strategy*/
	if(WrongSlect_u8 == GP_TLF35584_FWD_RESET_ACTION)
	{
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP,GP_TLF35584_FWD_ERR_ANSWER);
		Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP,GP_TLF35584_FWD_ERR_ANSWER);
		Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSP,GP_TLF35584_FWD_ERR_ANSWER);
		Data_pst->SpiData_tst.TxBuf_au16[3U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_FWDRSPSYNC,GP_TLF35584_FWD_ERR_ANSWER);
		Data_pst->SpiData_tst.CntTx_u16 = 4U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	}
	else
	{
		#if(GP_TLF35584_WWD_BIST_DELAY_ENABLE == STD_ON)
		Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_WWD_BIST_DELAY_TIME);
		#else
		Gp_TLF35584_GetWdgInfo();
		Gp_TLF35584_WwdSpiService();
		Gp_TLF35584_GetWdgInfo();
		Gp_TLF35584_WwdSpiService();
		#endif
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetState
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Gp_TLF35584_GetState: get device current state
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_GetState(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;

	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_DEVSTAT);
	Data_pst->SpiData_tst.CntTx_u16 = 1U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	/*get the current state*/
	Data_pst->StatusData_tst.DeviceState_u8 = (((uint8)Data_pst->SpiData_tst.RxBuf_au16[0U]) & GP_TLF35584_DEVICESTATE_MASK);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_WdgService
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: service wdg according to requirement
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_WdgService(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;

	/*only fwd*/
	if (Data_pst->StatusData_tst.WdMode_u8 == GP_TLF35584_FWD_SPI)
	{
		Gp_TLF35584_FwdSpiService(Data_pst->StatusData_tst.LastSeed_u8);
	}
	/*wwd fwd spi*/
	else if(Data_pst->StatusData_tst.WdMode_u8 == GP_TLF35584_FWD_WWD_SPI)
	{
		Gp_TLF35584_FwdSpiService(Data_pst->StatusData_tst.LastSeed_u8);
		Gp_TLF35584_WwdSpiService();
	}
	/*wwd wdi*/
	else if(Data_pst->StatusData_tst.WdMode_u8 == GP_TLF35584_WWD_WDI)
	{
		Gp_TLF35584_WwdWdiService();
	}
	/*wwd spi*/
	else if(Data_pst->StatusData_tst.WdMode_u8 == GP_TLF35584_WWD_SPI)
	{
		Gp_TLF35584_WwdSpiService();
	}
	/*wwd wdi fwd spi*/
	else if(Data_pst->StatusData_tst.WdMode_u8 == GP_TLF35584_FWD_SPI_WWD_WDI)
	{
		Gp_TLF35584_FwdSpiService(Data_pst->StatusData_tst.LastSeed_u8);
		Gp_TLF35584_WwdWdiService();
	}
	else
	{
		/*for misra c*/
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetAllFaultRegister
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: get all fault register content when TLF35584 in fault state
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_GetAllFaultRegister(void)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;
	uint32	Cnt_u32 = 0U;
	uint8	RegValue_au8[GP_TLF35584_FLAG_RECOVER_NUM] = {0U};

	Gp_TLF35584_UpdateFlagReg();
	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_FLAG_RECOVER_NUM; Cnt_u32++)
	{
		RegValue_au8[Cnt_u32] =\
							Gp_TLF35584_idxFlagRegValue_lau8[Cnt_u32 + GP_TLF35584_REGISTER_OFFSET_4];
		/*the chip reported a fault*/
		if(RegValue_au8[Cnt_u32] != 0U)
		{
			Data_pst->ErrData_tst.DriverErrPath_u32 |= GP_TLF35584_SYSTEM_ERR;
			Gp_TLF35584_ClearFlagReg();
			Gp_TLF35584_SwitchToNormalMode();
			break;
		}
		else
		{
			Data_pst->ErrData_tst.DriverErrPath_u32 &= (~GP_TLF35584_SYSTEM_ERR);
		}
	}
	if((Data_pst->ErrData_tst.DriverErrPath_u32 & GP_TLF35584_SYSTEM_ERR) == GP_TLF35584_SYSTEM_ERR)
	{
		Data_pst->FaultDebonce_tst.ReadFaultCnt_u8++;
		if(Data_pst->FaultDebonce_tst.ReadFaultCnt_u8 >= GP_TLF35584_TRY_REPAIR_MAX)
		{
			/*to keep counter always above GP_TLF35584_TRY_REPAIR_MAX,to avoid counter overflow*/
			Data_pst->FaultDebonce_tst.ReadFaultCnt_u8 = GP_TLF35584_TRY_REPAIR_MAX;
			if(Data_pst->FaultDebonce_tst.FaultThreshold_u8 < 255U)
			{
				Data_pst->FaultDebonce_tst.FaultThreshold_u8++;
			}else
			{
				/*for misera*/
			}
			for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_FLAG_RECOVER_NUM; Cnt_u32++)
			{
				RegValue_au8[Cnt_u32] = Gp_TLF35584_idxFlagRegValue_lau8[Cnt_u32 + GP_TLF35584_REGISTER_OFFSET_4];
			}
			/*disable interrupt in case task be interrupted during zero error data or write error data*/
			Gp_TLF35584_CalloutDisableIntrrupt();
			/*zero error data before write it*/
			for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_FAULT_SIGNAL_NUMS; Cnt_u32++)
			{
				Data_pst->ErrData_tst.ErrRecord_au32[Cnt_u32] = 0U;
			}
			/*chip fault*/
			/*OTF*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_CHIP_FAULT] |=\
					(uint32)(((RegValue_au8[1U] >> GP_TLF35584_REGISTER_OFFSET_1) & 0x01U) << 0U);
			/*VBATOV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_CHIP_FAULT] |=\
					(uint32)(((RegValue_au8[5U] >> GP_TLF35584_REGISTER_OFFSET_0) & 0x01U) << 1U);
			/*BG12UV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_CHIP_FAULT] |=\
					(uint32)(((RegValue_au8[5U] >> GP_TLF35584_REGISTER_OFFSET_4) & 0x01U) << 2U);
			/*BG12OV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_CHIP_FAULT] |=\
					(uint32)(((RegValue_au8[5U] >> GP_TLF35584_REGISTER_OFFSET_5) & 0x01U) << 3U);
			/*BIASLOW*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_CHIP_FAULT] |=\
					(uint32)(((RegValue_au8[5U] >> GP_TLF35584_REGISTER_OFFSET_6) & 0x01U) << 4U);
			/*BIASHI*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_CHIP_FAULT] |=\
					(uint32)(((RegValue_au8[5U] >> GP_TLF35584_REGISTER_OFFSET_7) & 0x01U) << 5U);

			/*TRK2SG*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_TRACKER2_FAULT] |=\
					(uint32)(((RegValue_au8[2U] >> GP_TLF35584_REGISTER_OFFSET_7) & 0x01U) << 0U);
			/*TRK2UV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_TRACKER2_FAULT] |=\
					(uint32)(((RegValue_au8[4U] >> GP_TLF35584_REGISTER_OFFSET_7) & 0x01U) << 1U);
			/*TRK2OV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_TRACKER2_FAULT] |=\
					(uint32)(((RegValue_au8[3U] >> GP_TLF35584_REGISTER_OFFSET_7) & 0x01U) << 2U);

			/*TRK1SG*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_TRACKER1_FAULT] |=\
					(uint32)(((RegValue_au8[2U] >> GP_TLF35584_REGISTER_OFFSET_6) & 0x01U) << 0U);
			/*TRK1UV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_TRACKER1_FAULT] |=\
					(uint32)(((RegValue_au8[4U] >> GP_TLF35584_REGISTER_OFFSET_6) & 0x01U) << 1U);
			/*TRK1OV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_TRACKER1_FAULT] |=\
					(uint32)(((RegValue_au8[3U] >> GP_TLF35584_REGISTER_OFFSET_6) & 0x01U) << 2U);

			/*VREFSG*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_VREF_FAULT] |=\
					(uint32)(((RegValue_au8[2U] >> GP_TLF35584_REGISTER_OFFSET_5) & 0x01U) << 0U);
			/*VREFUV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_VREF_FAULT] |=\
					(uint32)(((RegValue_au8[4U] >> GP_TLF35584_REGISTER_OFFSET_5) & 0x01U) << 1U);
			/*VREFOV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_VREF_FAULT] |=\
					(uint32)(((RegValue_au8[3U] >> GP_TLF35584_REGISTER_OFFSET_5) & 0x01U) << 2U);

			/*COMSG*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_COM_FAULT] |=\
					(uint32)(((RegValue_au8[2U] >> GP_TLF35584_REGISTER_OFFSET_4) & 0x01U) << 0U);
			/*COMUV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_COM_FAULT] |=\
					(uint32)(((RegValue_au8[4U] >> GP_TLF35584_REGISTER_OFFSET_4) & 0x01U) << 1U);
			/*COMOV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_COM_FAULT] |=\
					(uint32)(((RegValue_au8[3U] >> GP_TLF35584_REGISTER_OFFSET_4) & 0x01U) << 2U);


			/*VCORESG*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_VCORE_FAULT] |=\
					(uint32)(((RegValue_au8[2U] >> GP_TLF35584_REGISTER_OFFSET_3) & 0x01U) << 0U);
			/*VCOREUV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_VCORE_FAULT] |=\
					(uint32)(((RegValue_au8[4U] >> GP_TLF35584_REGISTER_OFFSET_3) & 0x01U) << 1U);
			/*VCOREOV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_VCORE_FAULT] |=\
					(uint32)(((RegValue_au8[3U] >> GP_TLF35584_REGISTER_OFFSET_3) & 0x01U) << 2U);

			/*UCSG*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_UC_FAULT] |=\
					(uint32)(((RegValue_au8[2U] >> GP_TLF35584_REGISTER_OFFSET_2) & 0x01U) << 0U);
			/*UCUV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_UC_FAULT] |=\
					(uint32)(((RegValue_au8[4U] >> GP_TLF35584_REGISTER_OFFSET_2) & 0x01U) << 1U);
			/*UCOV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_UC_FAULT] |=\
					(uint32)(((RegValue_au8[3U] >> GP_TLF35584_REGISTER_OFFSET_2) & 0x01U) << 2U);

			/*STBYSG*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_STANDBY_FAULT] |=\
					(uint32)(((RegValue_au8[2U] >> GP_TLF35584_REGISTER_OFFSET_1) & 0x01U) << 0U);
			/*STBYUV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_STANDBY_FAULT] |=\
					(uint32)(((RegValue_au8[4U] >> GP_TLF35584_REGISTER_OFFSET_1) & 0x01U) << 1U);
			/*STBYOV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_STANDBY_FAULT] |=\
					(uint32)(((RegValue_au8[3U] >> GP_TLF35584_REGISTER_OFFSET_1) & 0x01U) << 2U);

			/*PRESG*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_PREG_FAULT] |=\
					(uint32)(((RegValue_au8[2U] >> GP_TLF35584_REGISTER_OFFSET_0) & 0x01U) << 0U);
			/*PREUV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_PREG_FAULT] |=\
					(uint32)(((RegValue_au8[4U] >> GP_TLF35584_REGISTER_OFFSET_0) & 0x01U) << 1U);
			/*PREOV*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_PREG_FAULT] |=\
					(uint32)(((RegValue_au8[3U] >> GP_TLF35584_REGISTER_OFFSET_0) & 0x01U) << 2U);

			/*SPI FAULT*/
			Data_pst->ErrData_tst.ErrRecord_au32[GP_TLF35584_SPILOGICAL_FAULT] = (uint32)RegValue_au8[0U];

			Gp_TLF35584_CalloutEnableIntrrupt();
		}
		else
		{
			/*for misra c*/
		}
	}
	else
	{
		/*clear fault*/
		Data_pst->FaultDebonce_tst.ReadFaultCnt_u8 = 0U;
		Data_pst->ErrData_tst.DriverErrPath_u32 &= (~GP_TLF35584_SYSTEM_ERR);
		for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_FAULT_SIGNAL_NUMS; Cnt_u32++)
		{
			Data_pst->ErrData_tst.ErrRecord_au32[Cnt_u32] = 0U;
		}
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetWdgInfo
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: get scmd of WWD,
					  get device state of TLF35584,
					  get last seed of FWD,
					  get FWD error count,
					  get WWD error count,
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_GetWdgInfo(void)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;
	uint8	TempValue_u8 = 0U;

	/*A valid trigger signal is a falling edge from VWDI,high to VWDI,low*/
	if (TRUE == Data_pst->WdiRestoreFlag_b)
	{
		/*Wdi Pull HIGH */
	  Data_pst->WdiRestoreFlag_b = FALSE;
	  Gp_TLF35584_CalloutWdiService(STD_HIGH);
	}
	else
	{
		/*for misra c*/
	}
	Gp_TLF35584_UpdateStatusReg();

	/*device state*/
	TempValue_u8 = Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_REG_DEVSTAT_INDEX];
	/*device state*/
	Data_pst->StatusData_tst.DeviceState_u8 = (TempValue_u8 & GP_TLF35584_DEVICESTATE_MASK);

	/*wwd error count*/
	TempValue_u8 = Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_REG_WWDSTAT_INDEX];
	/*wwd error count*/
	Data_pst->StatusData_tst.WwdErrCnt_u8 = (TempValue_u8 & GP_TLF35584_WWDERRCNT_MASK);

	/*last seed*/
	TempValue_u8 = Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_REG_FWDSTAT0_INDEX];
	/*last seed*/
	Data_pst->StatusData_tst.LastSeed_u8 = (TempValue_u8 & GP_TLF35584_FWDQUESTMASK);

	/*rsp cnt*/
	TempValue_u8 = Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_REG_FWDSTAT0_INDEX];
	/*rsp cnt*/
	Data_pst->StatusData_tst.RspCnt_u8 = ((TempValue_u8 & GP_TLF35584_FWDRSPMASK) >> GP_TLF35584_REGISTER_OFFSET_4);

	/*fwd error count*/
	TempValue_u8 = Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_REG_FWDSTAT1_INDEX];
	/*fwd error count*/
	Data_pst->StatusData_tst.FwdErrCnt_u8 = (TempValue_u8 & GP_TLF35584_FWDERRCNT_MASK);

	/*last wwd scmd*/
	TempValue_u8 = Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_REG_WWDSCMD_INDEX];
	/*last wwd scmd*/
	Data_pst->StatusData_tst.LastWwdScmd_u8 = (TempValue_u8 >> GP_TLF35584_REGISTER_OFFSET_7);

}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SwitchToStandbyMode
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: in normal state make TLF35584 regulators output off and switch TLF35584 to standby mode
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_SwitchToStandbyMode(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint8 DevCtrl_u8   = 0U;
	uint8 DevCtrlN_u8  = 0U;
	uint8 Cnt_u32 = 0U;
	#if(GP_TLF35584_WAKE_UP_SOURCE_CONFIRM == STD_ON)
	Std_ReturnType	Ret_t = E_NOT_OK;
	#endif

	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_TRY_REPAIR_MAX; Cnt_u32++)
	{
		#if(GP_TLF35584_WAKE_UP_SOURCE_CONFIRM == STD_ON)
		Ret_t = Gp_TLF35584_CalloutWkSourceConfirm();
		if(Ret_t == E_OK)
		{
		#endif
			/*get state*/
			Gp_TLF35584_GetState();
			/*the device in normal state*/
			if(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE)
			{
				DevCtrl_u8 |= GP_TLF35584_STANDBY_STATEM;
				DevCtrlN_u8 = (0xFFU ^ DevCtrl_u8);
				Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_DEVCTRL, DevCtrl_u8);
				Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_DEVCTRLN, DevCtrlN_u8);
				Data_pst->SpiData_tst.CntTx_u16 = 2U;
				Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
				Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
				break;
			}
			else
			{
				Gp_TLF35584_DisableWdgFsp();
				Gp_TLF35584_ClearFlagReg();
				Gp_TLF35584_SwitchToNormalMode();
			}

		#if(GP_TLF35584_WAKE_UP_SOURCE_CONFIRM == STD_ON)
		}
		else
		{
			Data_pst->ErrData_tst.DriverErrPath_u32 |= GP_TLF35584_WAKE_UP_SOURCE_ERR;
			#if(GP_TLF35584_DEM_ERROR_ENABLE == GP_TLF35584_ENABLE)
			Gp_TLF35584_CalloutDemReport(GP_TLF35584_WAKE_UP_SOURCE_FAULT, GP_TLF35584_FAILED);
			#endif
		}
		#endif
	}
	if (Cnt_u32 == GP_TLF35584_TRY_REPAIR_MAX)
	{
		#if(GP_TLF35584_DEM_ERROR_ENABLE == GP_TLF35584_ENABLE)
		Gp_TLF35584_CalloutDemReport(GP_TLF35584_POWER_OFF_FAULT, GP_TLF35584_FAILED);
		#endif
		Data_pst->ErrData_tst.DriverErrPath_u32 |= GP_TLF35584_POWN_OFF_ERR;
	}
	else
	{
		/*for misra c*/
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SwitchToNormalMode
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Gp_TLF35584_SwitchToNormalMode
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_SwitchToNormalMode(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint8	DevCtrl_u8 = 0xEAU;
	uint8	DevCtrlN_u8 = (0xFFU ^ DevCtrl_u8);

	/*switch to normal mode*/
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_DEVCTRL,DevCtrl_u8);
	Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_DEVCTRLN,DevCtrlN_u8);
	Data_pst->SpiData_tst.CntTx_u16 = 2U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_DEVSTAT);
	Data_pst->SpiData_tst.CntTx_u16 = 1U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SetPorstMode
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Gp_TLF35584_SetPorstMode
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_SetPorstMode(uint8 ResetSlect_u8)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;
	uint8	ErrCnt_u8 = 0U;
	uint8	Fwdstat1_u8 = 0U;
	uint8	wwdstat_u8 = 0U;
	uint8	Wdcfg0_u8 = 0U;

	Gp_TLF35584_UpdateStatusReg();
	if(ResetSlect_u8 == GP_TLF35584_FWD_RESET_ACTION)
	{
		Fwdstat1_u8 = Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_REG_FWDSTAT1_INDEX];
		ErrCnt_u8 = ((Fwdstat1_u8 & GP_TLF35584_FWDERRCNT_MASK) + 1U);
		Gp_TLF35584_UnlockSeq();
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WDCFG1,ErrCnt_u8);
		Data_pst->SpiData_tst.CntTx_u16 = 1U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
		Gp_TLF35584_LockSeq();
	}
	else
	{
		wwdstat_u8 = Gp_TLF35584_idxStatusRegValue_lau8[GP_TLF35584_REG_WWDSTAT_INDEX];
		ErrCnt_u8 = ((wwdstat_u8 & GP_TLF35584_WWDERRCNT_MASK) + 1U);
		Wdcfg0_u8 = ((((uint8)ErrCnt_u8) << 4U) | 0x0AU);
		Gp_TLF35584_UnlockSeq();
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WDCFG0,Wdcfg0_u8);
		Data_pst->SpiData_tst.CntTx_u16 = 1U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
		Gp_TLF35584_LockSeq();
	}
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
	Gp_TLF35584_WrongService(ResetSlect_u8);
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
	#if(GP_TLF35584_DEBUG_SUPPORT_ENABLE == STD_OFF)
	Data_pst->ErrData_tst.DriverErrPath_u32 |= GP_TLF35584_PORST_FAIL_ERROR;	/*porst failed*/
	#if(GP_TLF35584_DEM_ERROR_ENABLE == GP_TLF35584_ENABLE)
	Gp_TLF35584_CalloutDemReport(GP_TLF35584_PORST_MODE_FAULT, GP_TLF35584_FAILED);
	#endif
	#endif

}


/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_ColdStartAndPorst
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: TLF35584 get system unusual reason.
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_ColdStartAndPorst(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;

	/*Get power on flag*/
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_DEVCFG1);
	Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_DEVCFG1, GP_TLF35584_REG_DEVCFG1_VALUE);
	Data_pst->SpiData_tst.CntTx_u16 = 2U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	/*if DEVCFG1 is reset value,it's cold power on,because this reg reset type is R0*/
	if((Data_pst->SpiData_tst.RxBuf_au16[0U] & GP_TLF35584_COLD_ON_MASK) == GP_TLF35584_COLD_ON_FLAG)
	{
		Data_pst->StatusData_tst.SystemPor_bk_u8 = GP_TLF35584_SIGNAL_VALID;
	}
	else
	{
		/*Get porst reason*/
		Gp_TLF35584_GetResetType(GP_TLF35584_GETRST_DIAG);
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetWakeUpSource
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: pmci TLF35584 get system wake up source.
					  Data_pst->StatusData_tst.WakeupSource_u8 = 0	no wake-up source
					  Data_pst->StatusData_tst.WakeupSource_u8 = 1	WAK wake-up source
					  Data_pst->StatusData_tst.WakeupSource_u8 = 2	ENA wake-up source
					  Data_pst->StatusData_tst.WakeupSource_u8 = 3	QUC wake-up source
					  Data_pst->StatusData_tst.WakeupSource_u8 = 4	TIMER wake-up source
					  Data_pst->StatusData_tst.WakeupSource_u8 = 5	SPI wake-up source
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_GetWakeUpSource(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint8	Wakeup_u8 = 0U;

	Gp_TLF35584_UpdateFlagReg();
	Wakeup_u8 = Gp_TLF35584_idxFlagRegValue_lau8[GP_TLF35584_REG_WKSF_INDEX] & GP_TLF35584_WAKE_UP_MASK;
	/*Get wakeup source*/
	if((Wakeup_u8 & GP_TLF35584_WAK_MASK) == GP_TLF35584_WAK_MASK)
	{
		/*WAK*/
		Data_pst->StatusData_tst.WakeupSource_bk_u8 = GP_TLF35584_WAK_FLAG;
	}
	else if((Wakeup_u8 & GP_TLF35584_ENA_MASK) == GP_TLF35584_ENA_MASK)
	{
		/*ENA*/
		Data_pst->StatusData_tst.WakeupSource_bk_u8 = GP_TLF35584_ENA_FLAG;
	}
	else if((Wakeup_u8 & GP_TLF35584_QUC_MASK) == GP_TLF35584_QUC_MASK)
	{
		/*QUC*/
		Data_pst->StatusData_tst.WakeupSource_bk_u8 = GP_TLF35584_QUC_FLAG;
	}
	else if((Wakeup_u8 & GP_TLF35584_TIMER_MASK) == GP_TLF35584_TIMER_MASK)
	{
		/*TIMER*/
		Data_pst->StatusData_tst.WakeupSource_bk_u8 = GP_TLF35584_TIMER_FLAG;
	}
	else if((Wakeup_u8 & GP_TLF35584_SPI_MASK) == GP_TLF35584_SPI_MASK)
	{
		/*SPI*/
		Data_pst->StatusData_tst.WakeupSource_bk_u8 = GP_TLF35584_SPI_FLAG;
	}
	else
	{
		/*invalid*/
		Data_pst->StatusData_tst.WakeupSource_bk_u8 = GP_TLF35584_SIGNAL_INVALID;
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_GetResetType
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: pmci TLF35584 get porst reason:
					:		7			6			5		4		3		2		1		0
					:	Hard reset 	 Soft reset	   ERRF	   FWDF	   WWDF	  VMONF	  STBYUV   UCUV
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_GetResetType(uint8 phase_u8)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint8	IniterrReg_u8 = 0U;
	uint8	Monsf2Reg_u8 = 0U;
	uint8	Monsf2RegUcUv_u8 = 0U;
	uint8	Monsf2RegStbUv_u8 = 0U;
	
	Gp_TLF35584_UpdateFlagReg();
	if(phase_u8 == GP_TLF35584_GETRST_DIAG)
	{
		IniterrReg_u8 = Gp_TLF35584_idxFlagRegValue_lau8[GP_TLF35584_REG_INITERR_INDEX];
		Monsf2Reg_u8 = Gp_TLF35584_idxFlagRegValue_lau8[GP_TLF35584_REG_MONSF2_INDEX];
		Data_pst->StatusData_tst.ResetType_bk_u8 = (IniterrReg_u8) & (GP_TLF35584_PORST_REASON_MASK);
		Monsf2RegUcUv_u8 = (Monsf2Reg_u8 & GP_TLF35584_PORST_UCUV_MASK);
		Monsf2RegStbUv_u8 = (Monsf2Reg_u8 & GP_TLF35584_PORST_STBYUV_MASK);
		if(Monsf2RegUcUv_u8 == GP_TLF35584_PORST_UCUV_MASK)
		{
			Data_pst->StatusData_tst.ResetType_bk_u8 |= GP_TLF35584_PORST_REASON_UCUV;
		}
		else
		{
			/*for misra c*/
		}
		if(Monsf2RegStbUv_u8 == GP_TLF35584_PORST_STBYUV_MASK)
		{
			Data_pst->StatusData_tst.ResetType_bk_u8 |= GP_TLF35584_PORST_REASON_STBYUV;
		}
		else
		{
			/*for misra c*/
		}
	}else if(phase_u8 == GP_TLF35584_GETRST_RUN)
	{
		IniterrReg_u8 = Gp_TLF35584_idxFlagRegValue_lau8[GP_TLF35584_REG_INITERR_INDEX];
		Monsf2Reg_u8 = Gp_TLF35584_idxFlagRegValue_lau8[GP_TLF35584_REG_MONSF2_INDEX];
		Data_pst->StatusData_tst.ResetType_u8 = (IniterrReg_u8) & (GP_TLF35584_PORST_REASON_MASK);
		Monsf2RegUcUv_u8 = (Monsf2Reg_u8 & GP_TLF35584_PORST_UCUV_MASK);
		Monsf2RegStbUv_u8 = (Monsf2Reg_u8 & GP_TLF35584_PORST_STBYUV_MASK);
		if(Monsf2RegUcUv_u8 == GP_TLF35584_PORST_UCUV_MASK)
		{
			Data_pst->StatusData_tst.ResetType_u8 |= GP_TLF35584_PORST_REASON_UCUV;
		}
		else
		{
			/*for misra c*/
		}
		if(Monsf2RegStbUv_u8 == GP_TLF35584_PORST_STBYUV_MASK)
		{
			Data_pst->StatusData_tst.ResetType_u8 |= GP_TLF35584_PORST_REASON_STBYUV;
		}
		else
		{
			/*for misra c*/
		}
	}else
	{

	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_DisableWdgFsp
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Disable err pin and watchdog
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_DisableWdgFsp(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;

	Gp_TLF35584_UnlockSeq();
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WDCFG0, GP_TLF35584_DISABLE_WDG_ERRPIN);
	Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_SYSPCFG1, GP_TLF35584_DISABLE_WDG_ERRPIN);
	Data_pst->SpiData_tst.CntTx_u16 = 2U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	Gp_TLF35584_LockSeq();
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_RtWdgRegCfg
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: change watchdog timebase apply to runtime phase(1ms->0.1ms)
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_RtWdgRegCfg(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint8 RwdCfgVal_u8 = 0U;
	uint8 RwdCfgVal1_u8 = 0U;

	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_RWDCFG0);
	Data_pst->SpiData_tst.CntTx_u16 = 1U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	/*get the current WDG Configure state*/
	RwdCfgVal_u8 =(uint8)(Data_pst->SpiData_tst.RxBuf_au16[0U] & 0xFF);
	/*WDCYC bit change to 0U,0.1ms*/
	RwdCfgVal_u8 = RwdCfgVal_u8 & 0xFEU;

	/*DISABLE FWD/WWD*/
	RwdCfgVal1_u8 = RwdCfgVal_u8 & 0xF3U;

	Gp_TLF35584_UnlockSeq();
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WDCFG0,RwdCfgVal1_u8);
	Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WDCFG0,RwdCfgVal_u8);
	Data_pst->SpiData_tst.CntTx_u16 = 2U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	Gp_TLF35584_LockSeq();
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SetWkUpTimer
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: uint8 WkUpEn_u8:0--disable Timer;1--enable timer
** 					  uint32 Ticks_u32: per tick = 10ms,max threshold is 24bit
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Set wake up timer enable
***********************************************************************************************************************/
Std_ReturnType Gp_TLF35584_SetWkUpTimer(uint8 WkUpEn_u8,uint32 Ticks_u32 )
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint32 TicksTmp_u32 = 0U;
	Std_ReturnType Ret_t = E_NOT_OK;
	uint8 WkUpEnTmp_u8 = 0U;
	uint8 TickLow_u8 = 0U;
	uint8 TickMid_u8 = 0U;
	uint8 TickHigh_u8 = 0U;
	uint8 DevCf0Val_u8 = 0U;

	WkUpEnTmp_u8 = WkUpEn_u8;
	TicksTmp_u32 = Ticks_u32;

	if((WkUpEnTmp_u8 <= GP_TLF35584_ENABLE) && (TicksTmp_u32 < GP_TLF35584_TIMER_THRESHOULD))
	{
	    /*register is 8bit,so divide user input u32 into 3 u8*/
		TickLow_u8 = (uint8)(TicksTmp_u32 & 0x000000FFU);
		TickMid_u8 = (uint8)((TicksTmp_u32 & 0x0000FF00U) >> 8U);
		TickHigh_u8 = (uint8)((TicksTmp_u32 & 0x00FF0000U) >> 16U);
		/*enable wake up timer*/
		if(WkUpEn_u8 == GP_TLF35584_ENABLE)
		{
			DevCf0Val_u8 = 0xC8U;
		}else
		{
			DevCf0Val_u8 = 0x48U;
		}
		Gp_TLF35584_UnlockSeq();
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(Gp_TLF35584_idxInitRegAddress_cau8[0U],\
				DevCf0Val_u8);
		Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(Gp_TLF35584_idxInitRegAddress_cau8[14U],\
				TickLow_u8);
		Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_WriteCmd(Gp_TLF35584_idxInitRegAddress_cau8[15U],\
				TickMid_u8);
		Data_pst->SpiData_tst.TxBuf_au16[3U] = Gp_TLF35584_WriteCmd(Gp_TLF35584_idxInitRegAddress_cau8[16U],\
				TickHigh_u8);
		Data_pst->SpiData_tst.CntTx_u16 = 4U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
		Gp_TLF35584_LockSeq();

		Ret_t = E_OK;
	}else
	{
		Ret_t = E_NOT_OK;
	}

	return Ret_t;
}
/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_InitRegCfg
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: init all register apply to init phase
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_InitRegCfg(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint32	Cnt_u32	= 0U;

	Gp_TLF35584_UnlockSeq();

	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_INIT_REG_NUM; Cnt_u32++)
	{
		Data_pst->SpiData_tst.TxBuf_au16[Cnt_u32] = Gp_TLF35584_WriteCmd(Gp_TLF35584_idxInitRegAddress_cau8[Cnt_u32],\
															Gp_TLF35584_idxRtRegValue_cau8[Cnt_u32]);
	}

	Data_pst->SpiData_tst.CntTx_u16 = GP_TLF35584_INIT_REG_NUM;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	Gp_TLF35584_LockSeq();
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);

	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_STATUS_REG_NUM; Cnt_u32++)
	{
		Data_pst->SpiData_tst.TxBuf_au16[Cnt_u32] = Gp_TLF35584_ReadCmd(Gp_TLF35584_idxStatusRegAddress_cau8[Cnt_u32]);
	}

	Data_pst->SpiData_tst.CntTx_u16 = GP_TLF35584_STATUS_REG_NUM;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);

	/*register read back check*/
	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_PROTECT_REG_NUM; Cnt_u32++)
	{
		if(((uint8)Data_pst->SpiData_tst.RxBuf_au16[Cnt_u32 + GP_TLF35584_STU_REG_OFFSET]) !=\
				Gp_TLF35584_idxRtRegValue_cau8[Cnt_u32 + GP_TLF35584_INIT_REG_OFFSET])
		{
			Data_pst->ErrData_tst.DriverErrPath_u32 |= GP_TLF35584_PROTECT_REG_ERR;
			#if(GP_TLF35584_DEM_ERROR_ENABLE == GP_TLF35584_ENABLE)
			Gp_TLF35584_CalloutDemReport(GP_TLF35584_PROTECT_REG_FAULT, GP_TLF35584_FAILED);
			#endif
			break;
		}
		else
		{
			/*For misra c*/
		}
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_ClearFlagReg
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: TLF35584 clear all fault apply to power-on phase or other case
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_ClearFlagReg(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint32	Cnt_u32	= 0U;

	/*Clear fault,do not clear wake up source*/
	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)3U; Cnt_u32++)
	{

		Data_pst->SpiData_tst.TxBuf_au16[Cnt_u32] = \
							Gp_TLF35584_WriteCmd(Gp_TLF35584_idxFlagRegAddress_cau8[Cnt_u32], GP_TLF35584_FAULT_CLRMASK);
	}
	for(Cnt_u32 = 4U; Cnt_u32 < (uint32)GP_TLF35584_FLAG_REG_NUM; Cnt_u32++)
	{

		Data_pst->SpiData_tst.TxBuf_au16[Cnt_u32 - 1] = \
							Gp_TLF35584_WriteCmd(Gp_TLF35584_idxFlagRegAddress_cau8[Cnt_u32], GP_TLF35584_FAULT_CLRMASK);
	}

	Data_pst->SpiData_tst.CntTx_u16 = GP_TLF35584_FLAG_REG_NUM - 1;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_UpdateFlagReg
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: TLF35584 clear all fault apply to power-on phase or other case
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_UpdateFlagReg(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint32	Cnt_u32	= 0U;

	/*read all flag*/
	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_FLAG_REG_NUM; Cnt_u32++)
	{
		Data_pst->SpiData_tst.TxBuf_au16[Cnt_u32] = Gp_TLF35584_ReadCmd(Gp_TLF35584_idxFlagRegAddress_cau8[Cnt_u32]);
	}

	Data_pst->SpiData_tst.CntTx_u16 = GP_TLF35584_FLAG_REG_NUM;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);

	/*update all flag*/
	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_FLAG_REG_NUM; Cnt_u32++)
	{
		Gp_TLF35584_idxFlagRegValue_lau8[Cnt_u32] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[Cnt_u32]);
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_UpdateStatusReg
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: update all state register
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_UpdateStatusReg(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint32	Cnt_u32	= 0U;

	/*read all state register*/
	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_STATUS_REG_NUM; Cnt_u32++)
	{
		Data_pst->SpiData_tst.TxBuf_au16[Cnt_u32] = Gp_TLF35584_ReadCmd(Gp_TLF35584_idxStatusRegAddress_cau8[Cnt_u32]);
	}

	Data_pst->SpiData_tst.CntTx_u16 = GP_TLF35584_STATUS_REG_NUM;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);

	/*update all status*/
	for(Cnt_u32 = 0U; Cnt_u32 < (uint32)GP_TLF35584_STATUS_REG_NUM; Cnt_u32++)
	{
		Gp_TLF35584_idxStatusRegValue_lau8[Cnt_u32] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[Cnt_u32] & 0x00FFU);
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_RtSetMode
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: user set TLF35584 to target mode
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_RtSetMode(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;

	if(Data_pst->SetMode_u8 == GP_TLF35584_STANDBY_STATE)
	{
		Data_pst->SetMode_u8 = 0U;
		Gp_TLF35584_SwitchToStandbyMode();
	}
	else if(Data_pst->SetMode_u8 == GP_TLF35584_NORMAL_STATE)
	{
		Data_pst->SetMode_u8 = 0U;
		/*switch to normal control by ASYNC interface*/
		Data_pst->StatusData_tst.StateVar_u8 = GP_TLF35584_PREPARERUN_STATE;
	}
	else if(Data_pst->SetMode_u8 == GP_TLF35584_PORST_STATE)
	{
		Gp_TLF35584_SetPorstMode(GP_TLF35584_FWD_RESET_ACTION);
	}
	else
	{
		/*for misra c*/
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_PreInit
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: void
** Description		: Gp_TLF35584_PreInit function include init Memory and prepare Wdi service WWD
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_PreInit(void)
{
	Gp_TLF35584_AllDataType	*Data_pst 	= &Gp_TLF35584_rtData_ltst;

	/*Init Memory*/
	Data_pst->StatusData_tst.WdMode_u8 = GP_TLF35584_WD_MODE;
	Data_pst->StatusData_tst.StateVar_u8 = GP_TLF35584_INITIAL_TASK;
	Data_pst->ReInitRetry_u8 = 0U;
	Data_pst->StatusData_tst.ResetType_u8 = 0U;
	Data_pst->StatusData_tst.WakeupSource_u8 = 0U;
	Data_pst->StatusData_tst.ResetType_bk_u8 = 0U;
	Data_pst->StatusData_tst.SystemPor_bk_u8 = 0U;
	Data_pst->StatusData_tst.WakeupSource_bk_u8 = 0U;
	Data_pst->StatusData_tst.BistFunctCalled_u8 = FALSE;
	/*Prepare Wdi service WWD*/
	/*WDI Signal HIGH*/
	Data_pst->WdiRestoreFlag_b = FALSE;
	Gp_TLF35584_CalloutWdiService(STD_HIGH);
}

#if(GP_TLF35584_FWD_BIST_ENABLE == GP_TLF35584_ENABLE)
/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_FwdBist
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: TLF35584 FWD bist Wrong answer feeding the dog triggers the error
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_FwdBist(void)
{
	Gp_TLF35584_AllDataType	*Data_pst   = &Gp_TLF35584_rtData_ltst;
	#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
	Std_ReturnType	Return_u8 = E_NOT_OK;
	#endif

	/*change to normal,then cause a WDG error,check status*/
	Gp_TLF35584_DisableWdgFsp();
	Gp_TLF35584_ClearFlagReg();
	Gp_TLF35584_SwitchToNormalMode();
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
	Gp_TLF35584_GetState();
	if(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE)
	{
		Gp_TLF35584_UnlockSeq();
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WDCFG0, 0x94U);
		Data_pst->SpiData_tst.CntTx_u16 = 1U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
		Gp_TLF35584_LockSeq();

		Gp_TLF35584_SetPorstMode(GP_TLF35584_FWD_RESET_ACTION);
		Gp_TLF35584_GetResetType(GP_TLF35584_GETRST_RUN);
		Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
		Gp_TLF35584_GetState();
		if((Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_INIT_STATE) &&\
					((Data_pst->StatusData_tst.ResetType_u8 & GP_TLF35584_RESET_FWDF) == GP_TLF35584_RESET_FWDF))
		{
			#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
			Return_u8 = Gp_TLF35584_CalloutSafeStateConfirm();
			if(Return_u8 == E_OK)
			{
			#endif
				Gp_TLF35584_ClearFlagReg();
			#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
			}
			else
			{
				Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_11;
			}
			#endif
		}
		else
		{
			Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_10;
		}
	}
	else
	{
		Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_9;
	}
}
#endif

#if(GP_TLF35584_WWD_BIST_ENABLE == GP_TLF35584_ENABLE)
/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_WwdBist
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: TLF35584 WWD bist give an invalid trigger during window closing
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_WwdBist(void)
{
	Gp_TLF35584_AllDataType	*Data_pst   = &Gp_TLF35584_rtData_ltst;
	#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
	Std_ReturnType	Return_u8 = E_NOT_OK;
	#endif

	Gp_TLF35584_DisableWdgFsp();
	Gp_TLF35584_ClearFlagReg();
	Gp_TLF35584_SwitchToNormalMode();
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
	Gp_TLF35584_GetState();
	if(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE)
	{
		Gp_TLF35584_UnlockSeq();
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WDCFG0, GP_TLF35584_WWD_ENABLE);
		Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WWDCFG0, GP_TLF35584_WWD_CW_TIME);
		Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_WWDCFG1, GP_TLF35584_WWD_OW_TIME);
		Data_pst->SpiData_tst.CntTx_u16 = 3U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
		Gp_TLF35584_LockSeq();
		Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);

		Gp_TLF35584_SetPorstMode(GP_TLF35584_WWD_RESET_ACTION);
		Gp_TLF35584_GetResetType(GP_TLF35584_GETRST_RUN);
		Gp_TLF35584_GetState();
		if((Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_INIT_STATE) &&\
					((Data_pst->StatusData_tst.ResetType_u8 & GP_TLF35584_RESET_WWDF) == GP_TLF35584_RESET_WWDF))
		{
			#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
			Return_u8 = Gp_TLF35584_CalloutSafeStateConfirm();
			if(Return_u8 == E_OK)
			{
			#endif
				Gp_TLF35584_ClearFlagReg();
				Data_pst->StatusData_tst.ResetType_u8 = 0U;
			#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
			}
			else
			{
				Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_14;
			}
			#endif
		}
		else
		{
			Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_13;
		}
	}
	else
	{
		Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_12;
	}

}
#endif

#if(GP_TLF35584_ERR_BIST_ENABLE == GP_TLF35584_ENABLE)
/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_Errpin_Bist
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: TLF35584 ERR PIN bist
***********************************************************************************************************************/
GP_TLF35584_STATIC_	void	Gp_TLF35584_Errpin_Bist (void)
{
	Gp_TLF35584_AllDataType	*Data_pst   = &Gp_TLF35584_rtData_ltst;
	#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
	Std_ReturnType	Return_u8 = E_NOT_OK;
	#endif

	Gp_TLF35584_DisableWdgFsp();
	Gp_TLF35584_ClearFlagReg();
	Gp_TLF35584_SwitchToNormalMode();
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
	Gp_TLF35584_GetState();

	#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
	Return_u8 = Gp_TLF35584_CalloutSafeStateConfirm();
	if(Return_u8 == E_NOT_OK)
	{
	#endif
		if(Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_NORMAL_STATE)
		{
			Gp_TLF35584_UnlockSeq();
			Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_SYSPCFG1,0x8U);
			Data_pst->SpiData_tst.CntTx_u16 = 1U;
			Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
			Gp_TLF35584_LockSeq();

			Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_MODE_SWITCH_DELAY);
			/*2.Check on application level that the safe state outputs SS1/2 are high and the secondary safety shutdown is
			deactivated.*/
			#if(GP_TLF35584_SMU_CONFIG_ENABLE == STD_ON)
			Smu_ActivateFSP();
			Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_BIST_DELAY_250);
			#endif
			/*
			* Low Frequency(0--5KHZ):(50.1us----90.9us)
			* High Frequency(96.2--500KHZ):(5.2us----11.1us)
			* */
			/*delay time 10us---90us*/
			Gp_TLF35584_GetResetType(GP_TLF35584_GETRST_RUN);
			Gp_TLF35584_GetState();
			if((Data_pst->StatusData_tst.DeviceState_u8 == GP_TLF35584_INIT_STATE) &&\
						((Data_pst->StatusData_tst.ResetType_u8 & GP_TLF35584_RESET_ERRF) == GP_TLF35584_RESET_ERRF))
			{
				#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
				Return_u8 = Gp_TLF35584_CalloutSafeStateConfirm();
				if(Return_u8 == E_OK)
				{
				#endif
					#if(GP_TLF35584_SMU_CONFIG_ENABLE == STD_ON)
					Smu_ReleaseFSP();
					Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_BIST_DELAY_250);
					Gp_TLF35584_ClearFlagReg();
					#endif
				#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
				}
				else
				{
					Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_17;
				}
				#endif
			}
			else
			{
				Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_16;
			}
		}
		else
		{
			Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_15;
		}
	#if(GP_TLF35584_SS1_SS2_SIGNAL_CONFIRM == STD_ON)
	}
	else
	{

	}
	#endif
}
#endif

#if(GP_TLF35584_ANA_BIST_ENABLE == GP_TLF35584_ENABLE)
/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SinSafetyBistCheck
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Select a single comparator contributing to the generation of the safety path
***********************************************************************************************************************/
GP_TLF35584_STATIC_	Std_ReturnType	Gp_TLF35584_SinSafetyBistCheck(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	uint8	AbistCtrl0_u8 = 0U;
	uint8	AbistSlect0_u8 = 0U;
	uint8	Monsf1_u8 = 0U;
	Std_ReturnType Ret_t = E_NOT_OK;

	Gp_TimeCal_CaptureStart(&Gp_TLF35584_SingAnalogBistCal_lst);

	while(Ret_t == E_NOT_OK)
	{
		Gp_TimeCal_CaptureStop(&Gp_TLF35584_SingAnalogBistCal_lst);

		if(Gp_TLF35584_SingAnalogBistCal_lst.Interval_Us_f32 > GP_TLF35584_ABIST_SINGLE_MAXTIME)
		{
			break;
		}

		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_MONSF1);
		Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_ABIST_CTRL0);
		Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_ABIST_SELECT0);

		Data_pst->SpiData_tst.CntTx_u16 = 3U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);

		Monsf1_u8 = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[0U] & 0xFF);
		AbistCtrl0_u8 = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[1U] & 0xFF);
		AbistSlect0_u8 = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[2U] & 0xFF);

		if((AbistCtrl0_u8 & GP_TLF35584_BIST_SUCCEED) == (GP_TLF35584_BIST_SUCCEED))
		{
			Data_pst->ErrData_tst.BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_0;

			if((AbistSlect0_u8 & GP_TLF35584_UCOV_SELECT0) == (uint8)GP_TLF35584_NO_ERROR)
			{
				Data_pst->ErrData_tst.BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_1;

				if((Monsf1_u8 & GP_TLF35584_UCOV_MONSF1) == GP_TLF35584_UCOV_MONSF1)
				{
					Data_pst->ErrData_tst.BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_2;
					Ret_t = E_OK;
				}
				else
				{
					Ret_t |= E_NOT_OK;
					Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_2;
				}
			}
			else
			{
				Ret_t |= E_NOT_OK;
				Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_1;
			}
		}
		else
		{
			Ret_t |= E_NOT_OK;
			Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_0;
		}
	}

	return(Ret_t);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SingleOvSafetyPathBist
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Select a single comparator contributing to the generation of the safety path
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_SingleOvSafetyPathBist(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;
	Std_ReturnType Ret_t = E_NOT_OK;

	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_SELECT0,GP_TLF35584_UCOV_SELECT0);
	Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_CTRL0,GP_TLF35584_FULLPATH_BIST);
	Data_pst->SpiData_tst.CntTx_u16 = 2U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);

	Ret_t = Gp_TLF35584_SinSafetyBistCheck();
	if(Ret_t == E_OK)
	{
		Gp_TLF35584_ClearFlagReg();
	}
	else
	{
		Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_3;
		/*BIST fail,restore register for analysis*/
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_MONSF1);
		Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_ABIST_CTRL0);
		Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_ABIST_SELECT0);
		Data_pst->SpiData_tst.TxBuf_au16[3U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_VMONSTAT);
		Data_pst->SpiData_tst.TxBuf_au16[4U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_DEVSTAT);
		Data_pst->SpiData_tst.CntTx_u16 = 5U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
		Gp_TLF35584_BistErrRestore_lau8[0U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[0U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[1U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[1U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[2U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[2U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[3U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[3U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[4U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[4U] & 0xFFU);


	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_AllCompartorSafetyCmd
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Select all comparator contributing to the generation of the SafetyPath
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_AllCompartorSafetyCmd(void)
{
	Gp_TLF35584_AllDataType	*Data_pst = &Gp_TLF35584_rtData_ltst;

	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_CTRL1,GP_TLF35584_ABIST_CTRL1_OV);
	Data_pst->SpiData_tst.CntTx_u16 = 1U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_BIST_DELAY_50);
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_CTRL1,GP_TLF35584_ABIST_CTRL1_CLOCK);
	Data_pst->SpiData_tst.CntTx_u16 = 1U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_BIST_DELAY_50);
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_CTRL1,GP_TLF35584_ABIST_CTRL1_OV);
	Data_pst->SpiData_tst.CntTx_u16 = 1U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_BIST_DELAY_50);
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_CTRL1,GP_TLF35584_ABIST_CTRL1_DISABLE);
	Data_pst->SpiData_tst.CntTx_u16 = 1U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_BIST_DELAY_50);
	/*Select all (remaining) overvoltage comparators contributing to the Safety generation, i.e. write 11010000*/
	Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_SELECT0,GP_TLF35584_COMPARETOR_OV);
	Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_SELECT1,GP_TLF35584_COMPARETOR_UV);
	Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_SELECT2,GP_TLF35584_COMPARETOR_IN);
	Data_pst->SpiData_tst.TxBuf_au16[3U] = Gp_TLF35584_WriteCmd(GP_TLF35584_REG_ABIST_CTRL0,GP_TLF35584_SAFETY_ABIST_CTRL0);
	Data_pst->SpiData_tst.CntTx_u16 = 4U;
	Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
	/*delay 1000us*/
	Gp_TLF35584_CalloutStmSwDalayNus(GP_TLF35584_BIST_DELAY_1000);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_AllSafetyBistCheck
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Select a all comparator contributing to the generation of the safety path
***********************************************************************************************************************/
GP_TLF35584_STATIC_	Std_ReturnType	Gp_TLF35584_AllSafetyBistCheck(void)
{
	Gp_TLF35584_AllDataType	*Data_pst   = &Gp_TLF35584_rtData_ltst;
	uint8	AbistCtrl0_u8 = 0U;
	uint8	Monsf1_u8 = 0U;
	uint8	Monsf2_u8 = 0U;
	uint8	Monsf3_u8 = 0U;
	Std_ReturnType Ret_t = E_NOT_OK;

	Gp_TimeCal_CaptureStart(&Gp_TLF35584_MultiAnalogBistCal_lst);

	while(Ret_t == E_NOT_OK)
	{
		Gp_TimeCal_CaptureStop(&Gp_TLF35584_MultiAnalogBistCal_lst);

		if(Gp_TLF35584_MultiAnalogBistCal_lst.Interval_Us_f32 > GP_TLF35584_ABIST_MULTI_MAXTIME)
		{
			break;
		}
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_MONSF1);
		Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_MONSF2);
		Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_MONSF3);
		Data_pst->SpiData_tst.TxBuf_au16[3U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_ABIST_CTRL0);
		Data_pst->SpiData_tst.CntTx_u16 = 4U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);

		Monsf1_u8 = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[0U] & 0xFF);
		Monsf2_u8 = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[1U] & 0xFF);
		Monsf3_u8 = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[2U] & 0xFF);
		AbistCtrl0_u8 = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[3U] & 0xFF);

		if((AbistCtrl0_u8 & GP_TLF35584_BIST_SUCCEED) == (GP_TLF35584_BIST_SUCCEED))
		{
			Data_pst->ErrData_tst.BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_4;

			if((Monsf1_u8 & GP_TLF35584_MONSF1_MASK) == (GP_TLF35584_MONSF1_MASK))
			{
				Data_pst->ErrData_tst.BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_5;

				if((Monsf2_u8 & GP_TLF35584_MONSF2_MASK) == (GP_TLF35584_MONSF2_MASK))
				{
					Data_pst->ErrData_tst.BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_6;

					if((Monsf3_u8 & GP_TLF35584_MONSF3_MASK) == (GP_TLF35584_MONSF3_MASK))
					{
						Data_pst->ErrData_tst.BistErrPath_u32 &= ~GP_TLF35584_BIST_ERROR_7;
						Ret_t = E_OK;
					}
					else
					{
						Ret_t |= E_NOT_OK;
						Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_7;
					}
				}
				else
				{
					Ret_t |= E_NOT_OK;
					Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_6;
				}
			}
			else
			{
				Ret_t |= E_NOT_OK;
				Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_5;
			}
		}
		else
		{
			Ret_t |= E_NOT_OK;
			Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_4;
		}
	}
	return(Ret_t);
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_AllCompartorSafetyPathBist
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: Select all comparator contributing to the generation of the SafetyPath
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_AllCompartorSafetyPathBist(void)
{
	Gp_TLF35584_AllDataType	*Data_pst   = &Gp_TLF35584_rtData_ltst;
	Std_ReturnType Ret_t = E_NOT_OK;

	Gp_TLF35584_AllCompartorSafetyCmd();
	Ret_t = Gp_TLF35584_AllSafetyBistCheck();
	/*if bist pass*/
	if(Ret_t == E_OK)
	{
		/*clear flag*/
		Gp_TLF35584_ClearFlagReg();
	}
	else
	{
		Data_pst->ErrData_tst.BistErrPath_u32 |= GP_TLF35584_BIST_ERROR_8;
		/*BIST fail,restore register for analysis*/
		Data_pst->SpiData_tst.TxBuf_au16[0U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_MONSF1);
		Data_pst->SpiData_tst.TxBuf_au16[1U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_MONSF2);
		Data_pst->SpiData_tst.TxBuf_au16[2U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_MONSF3);
		Data_pst->SpiData_tst.TxBuf_au16[3U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_ABIST_CTRL0);
		Data_pst->SpiData_tst.TxBuf_au16[4U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_VMONSTAT);
		Data_pst->SpiData_tst.TxBuf_au16[5U] = Gp_TLF35584_ReadCmd(GP_TLF35584_REG_DEVSTAT);
		Data_pst->SpiData_tst.CntTx_u16 = 6U;
		Gp_TLF35584_TransmitData(Data_pst->SpiData_tst.CntTx_u16);
		Gp_TLF35584_BistErrRestore_lau8[5U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[0U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[6U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[1U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[7U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[2U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[8U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[3U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[9U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[4U] & 0xFFU);
		Gp_TLF35584_BistErrRestore_lau8[10U] = (uint8)(Data_pst->SpiData_tst.RxBuf_au16[5U] & 0xFFU);
	}
}

/***********************************************************************************************************************
** Function Name	: Gp_TLF35584_SafetypathBist
** Service ID		: None
** Sync/Async		: Synchronous
** Reentrancy		: Non_Reentrancy
** Parameter[in]	: None
** Parameter[inout]	: None
** Parameter[out]	: None
** Return Value		: None
** Description		: TLF35584 safety path bist
***********************************************************************************************************************/
GP_TLF35584_STATIC_ void	Gp_TLF35584_SafetypathBist (void)
{
	/*single comparator bist*/
	Gp_TLF35584_SingleOvSafetyPathBist();
	/*all comparator bist*/
	Gp_TLF35584_AllCompartorSafetyPathBist();
}
#endif

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
5.0.3
2025-11-28
1 delete mainfuncrion reinit logic,now init function directly write user configure value
2 add some annotation
3 change configure value,default device mode is init and wdg is count at 1ms
***********************************************************************************************************************/

