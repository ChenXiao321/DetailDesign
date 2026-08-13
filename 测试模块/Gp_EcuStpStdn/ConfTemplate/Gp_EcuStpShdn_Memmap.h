
#ifndef GP_ECUSTPSHDN_MEMMAP_H_
#define GP_ECUSTPSHDN_MEMMAP_H_

#define GP_ECUSTPSHDN_MEMMAP_ERROR


#if defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE0_START
    #pragma section farbss "ClearFarData.Align4.Core0.Gp_Ecustpshdn"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE0_START

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE0_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE0_STOP

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE1_START
    #pragma section farbss "ClearFarData.Align4.Core1.Gp_Ecustpshdn"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE1_START

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE1_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE1_STOP

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE2_START
    #pragma section farbss "ClearFarData.Align4.Core2.Gp_Ecustpshdn"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE2_START

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE2_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE2_STOP

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE3_START
    #pragma section farbss "ClearFarData.Align4.Core3.Gp_Ecustpshdn"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE3_START

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE3_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE3_STOP

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE4_START
    #pragma section farbss "ClearFarData.Align4.Core4.Gp_Ecustpshdn"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE4_START

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE4_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE4_STOP

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE5_START
    #pragma section farbss "ClearFarData.Align4.Core5.Gp_Ecustpshdn"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE5_START

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE5_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_CORE5_STOP

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_GLOBAL_START
    #pragma section farbss "ClearFarData.Align4.Global.Gp_Ecustpshdn"
    #pragma default_near_size 0
    #pragma clear
    #pragma align 4
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_GLOBAL_START

#elif defined GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_GLOBAL_STOP
    #pragma align restore
    #pragma clear restore
    #pragma default_near_size restore
    #pragma section farbss restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CLEAR_FAR_DATA_ALIGN4_GLOBAL_STOP

#elif defined GP_ECUSTPSHDN_CODE_START
    #pragma section code "Code.Gp_Ecustpshdn"
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CODE_START

#elif defined GP_ECUSTPSHDN_CODE_STOP
    #pragma section code restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CODE_STOP

#elif defined GP_ECUSTPSHDN_CONST_FAR_DATA_ALIGN4_GLOBAL_START
    #pragma section farrom "ConstFarData.Align4.Global.Gp_Ecustpshdn"
    #pragma default_near_size 0
    #pragma align 4
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CONST_FAR_DATA_ALIGN4_GLOBAL_START

#elif defined GP_ECUSTPSHDN_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP
    #pragma align restore
    #pragma default_near_size restore
    #pragma section farrom restore
    #undef GP_ECUSTPSHDN_MEMMAP_ERROR
    #undef GP_ECUSTPSHDN_CONST_FAR_DATA_ALIGN4_GLOBAL_STOP

#endif

#if defined GP_ECUSTPSHDN_MEMMAP_ERROR
    #error "Wrong pragma command in Gp_EcuStpShdn_MemMap.h"
#endif

#undef GP_ECUSTPSHDN_MEMMAP_H_
#endif