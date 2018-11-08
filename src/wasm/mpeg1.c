#include <string.h>
#include <stdlib.h>
#include "mpeg1.h"

static const float PICTURE_RATE[] = {
	0.000, 23.976, 24.000, 25.000, 29.970, 30.000, 50.000, 59.940,
	60.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
};

static const uint8_t ZIG_ZAG[] = {
	 0,  1,  8, 16,  9,  2,  3, 10,
	17, 24, 32, 25, 18, 11,  4,  5,
	12, 19, 26, 33, 40, 48, 41, 34,
	27, 20, 13,  6,  7, 14, 21, 28,
	35, 42, 49, 56, 57, 50, 43, 36,
	29, 22, 15, 23, 30, 37, 44, 51,
	58, 59, 52, 45, 38, 31, 39, 46,
	53, 60, 61, 54, 47, 55, 62, 63
};

static const uint8_t DEFAULT_INTRA_QUANT_MATRIX[] = {
	 8, 16, 19, 22, 26, 27, 29, 34,
	16, 16, 22, 24, 27, 29, 34, 37,
	19, 22, 26, 27, 29, 34, 34, 38,
	22, 22, 26, 27, 29, 34, 37, 40,
	22, 26, 27, 29, 32, 35, 40, 48,
	26, 27, 29, 32, 35, 40, 48, 58,
	26, 27, 29, 34, 38, 46, 56, 69,
	27, 29, 35, 38, 46, 56, 69, 83
};

static const uint8_t DEFAULT_NON_INTRA_QUANT_MATRIX[] = {
	16, 16, 16, 16, 16, 16, 16, 16,
	16, 16, 16, 16, 16, 16, 16, 16,
	16, 16, 16, 16, 16, 16, 16, 16,
	16, 16, 16, 16, 16, 16, 16, 16,
	16, 16, 16, 16, 16, 16, 16, 16,
	16, 16, 16, 16, 16, 16, 16, 16,
	16, 16, 16, 16, 16, 16, 16, 16,
	16, 16, 16, 16, 16, 16, 16, 16
};

static const uint8_t PREMULTIPLIER_MATRIX[] = {
	32, 44, 42, 38, 32, 25, 17,  9,
	44, 62, 58, 52, 44, 35, 24, 12,
	42, 58, 55, 49, 42, 33, 23, 12,
	38, 52, 49, 44, 38, 30, 20, 10,
	32, 44, 42, 38, 32, 25, 17,  9,
	25, 35, 33, 30, 25, 20, 14,  7,
	17, 24, 23, 20, 17, 14,  9,  5,
	 9, 12, 12, 10,  9,  7,  5,  2
};

// MPEG-1 VLC

//  macroblock_stuffing decodes as 34.
//  macroblock_escape decodes as 35.

static const int MACROBLOCK_ADDRESS_INCREMENT[] = {
	 1*3,  2*3,  0, //   0
	 3*3,  4*3,  0, //   1  0
	   0,    0,  1, //   2  1.
	 5*3,  6*3,  0, //   3  00
	 7*3,  8*3,  0, //   4  01
	 9*3, 10*3,  0, //   5  000
	11*3, 12*3,  0, //   6  001
	   0,    0,  3, //   7  010.
	   0,    0,  2, //   8  011.
	13*3, 14*3,  0, //   9  0000
	15*3, 16*3,  0, //  10  0001
	   0,    0,  5, //  11  0010.
	   0,    0,  4, //  12  0011.
	17*3, 18*3,  0, //  13  0000 0
	19*3, 20*3,  0, //  14  0000 1
	   0,    0,  7, //  15  0001 0.
	   0,    0,  6, //  16  0001 1.
	21*3, 22*3,  0, //  17  0000 00
	23*3, 24*3,  0, //  18  0000 01
	25*3, 26*3,  0, //  19  0000 10
	27*3, 28*3,  0, //  20  0000 11
	  -1, 29*3,  0, //  21  0000 000
	  -1, 30*3,  0, //  22  0000 001
	31*3, 32*3,  0, //  23  0000 010
	33*3, 34*3,  0, //  24  0000 011
	35*3, 36*3,  0, //  25  0000 100
	37*3, 38*3,  0, //  26  0000 101
	   0,    0,  9, //  27  0000 110.
	   0,    0,  8, //  28  0000 111.
	39*3, 40*3,  0, //  29  0000 0001
	41*3, 42*3,  0, //  30  0000 0011
	43*3, 44*3,  0, //  31  0000 0100
	45*3, 46*3,  0, //  32  0000 0101
	   0,    0, 15, //  33  0000 0110.
	   0,    0, 14, //  34  0000 0111.
	   0,    0, 13, //  35  0000 1000.
	   0,    0, 12, //  36  0000 1001.
	   0,    0, 11, //  37  0000 1010.
	   0,    0, 10, //  38  0000 1011.
	47*3,   -1,  0, //  39  0000 0001 0
	  -1, 48*3,  0, //  40  0000 0001 1
	49*3, 50*3,  0, //  41  0000 0011 0
	51*3, 52*3,  0, //  42  0000 0011 1
	53*3, 54*3,  0, //  43  0000 0100 0
	55*3, 56*3,  0, //  44  0000 0100 1
	57*3, 58*3,  0, //  45  0000 0101 0
	59*3, 60*3,  0, //  46  0000 0101 1
	61*3,   -1,  0, //  47  0000 0001 00
	  -1, 62*3,  0, //  48  0000 0001 11
	63*3, 64*3,  0, //  49  0000 0011 00
	65*3, 66*3,  0, //  50  0000 0011 01
	67*3, 68*3,  0, //  51  0000 0011 10
	69*3, 70*3,  0, //  52  0000 0011 11
	71*3, 72*3,  0, //  53  0000 0100 00
	73*3, 74*3,  0, //  54  0000 0100 01
	   0,    0, 21, //  55  0000 0100 10.
	   0,    0, 20, //  56  0000 0100 11.
	   0,    0, 19, //  57  0000 0101 00.
	   0,    0, 18, //  58  0000 0101 01.
	   0,    0, 17, //  59  0000 0101 10.
	   0,    0, 16, //  60  0000 0101 11.
	   0,    0, 35, //  61  0000 0001 000. -- macroblock_escape
	   0,    0, 34, //  62  0000 0001 111. -- macroblock_stuffing
	   0,    0, 33, //  63  0000 0011 000.
	   0,    0, 32, //  64  0000 0011 001.
	   0,    0, 31, //  65  0000 0011 010.
	   0,    0, 30, //  66  0000 0011 011.
	   0,    0, 29, //  67  0000 0011 100.
	   0,    0, 28, //  68  0000 0011 101.
	   0,    0, 27, //  69  0000 0011 110.
	   0,    0, 26, //  70  0000 0011 111.
	   0,    0, 25, //  71  0000 0100 000.
	   0,    0, 24, //  72  0000 0100 001.
	   0,    0, 23, //  73  0000 0100 010.
	   0,    0, 22  //  74  0000 0100 011.
};

//  macroblock_type bitmap:
//    0x10  macroblock_quant
//    0x08  macroblock_motion_forward
//    0x04  macroblock_motion_backward
//    0x02  macrobkock_pattern
//    0x01  macroblock_intra
//

static const int MACROBLOCK_TYPE_INTRA[] = {
	 1*3,  2*3,     0, //   0
	  -1,  3*3,     0, //   1  0
	   0,    0,  0x01, //   2  1.
	   0,    0,  0x11  //   3  01.
};

static const int MACROBLOCK_TYPE_PREDICTIVE[] = {
	 1*3,  2*3,     0, //  0
	 3*3,  4*3,     0, //  1  0
	   0,    0,  0x0a, //  2  1.
	 5*3,  6*3,     0, //  3  00
	   0,    0,  0x02, //  4  01.
	 7*3,  8*3,     0, //  5  000
	   0,    0,  0x08, //  6  001.
	 9*3, 10*3,     0, //  7  0000
	11*3, 12*3,     0, //  8  0001
	  -1, 13*3,     0, //  9  00000
	   0,    0,  0x12, // 10  00001.
	   0,    0,  0x1a, // 11  00010.
	   0,    0,  0x01, // 12  00011.
	   0,    0,  0x11  // 13  000001.
};

static const int MACROBLOCK_TYPE_B[] = {
	 1*3,  2*3,     0,  //  0
	 3*3,  5*3,     0,  //  1  0
	 4*3,  6*3,     0,  //  2  1
	 8*3,  7*3,     0,  //  3  00
	   0,    0,  0x0c,  //  4  10.
	 9*3, 10*3,     0,  //  5  01
	   0,    0,  0x0e,  //  6  11.
	13*3, 14*3,     0,  //  7  001
	12*3, 11*3,     0,  //  8  000
	   0,    0,  0x04,  //  9  010.
	   0,    0,  0x06,  // 10  011.
	18*3, 16*3,     0,  // 11  0001
	15*3, 17*3,     0,  // 12  0000
	   0,    0,  0x08,  // 13  0010.
	   0,    0,  0x0a,  // 14  0011.
	  -1, 19*3,     0,  // 15  00000
	   0,    0,  0x01,  // 16  00011.
	20*3, 21*3,     0,  // 17  00001
	   0,    0,  0x1e,  // 18  00010.
	   0,    0,  0x11,  // 19  000001.
	   0,    0,  0x16,  // 20  000010.
	   0,    0,  0x1a   // 21  000011.
};

static const int *MACROBLOCK_TYPE[] = {
	NULL,
	MACROBLOCK_TYPE_INTRA,
	MACROBLOCK_TYPE_PREDICTIVE,
	MACROBLOCK_TYPE_B
};

static const int CODE_BLOCK_PATTERN[] = {
	  2*3,   1*3,   0,  //   0
	  3*3,   6*3,   0,  //   1  1
	  4*3,   5*3,   0,  //   2  0
	  8*3,  11*3,   0,  //   3  10
	 12*3,  13*3,   0,  //   4  00
	  9*3,   7*3,   0,  //   5  01
	 10*3,  14*3,   0,  //   6  11
	 20*3,  19*3,   0,  //   7  011
	 18*3,  16*3,   0,  //   8  100
	 23*3,  17*3,   0,  //   9  010
	 27*3,  25*3,   0,  //  10  110
	 21*3,  28*3,   0,  //  11  101
	 15*3,  22*3,   0,  //  12  000
	 24*3,  26*3,   0,  //  13  001
	    0,     0,  60,  //  14  111.
	 35*3,  40*3,   0,  //  15  0000
	 44*3,  48*3,   0,  //  16  1001
	 38*3,  36*3,   0,  //  17  0101
	 42*3,  47*3,   0,  //  18  1000
	 29*3,  31*3,   0,  //  19  0111
	 39*3,  32*3,   0,  //  20  0110
	    0,     0,  32,  //  21  1010.
	 45*3,  46*3,   0,  //  22  0001
	 33*3,  41*3,   0,  //  23  0100
	 43*3,  34*3,   0,  //  24  0010
	    0,     0,   4,  //  25  1101.
	 30*3,  37*3,   0,  //  26  0011
	    0,     0,   8,  //  27  1100.
	    0,     0,  16,  //  28  1011.
	    0,     0,  44,  //  29  0111 0.
	 50*3,  56*3,   0,  //  30  0011 0
	    0,     0,  28,  //  31  0111 1.
	    0,     0,  52,  //  32  0110 1.
	    0,     0,  62,  //  33  0100 0.
	 61*3,  59*3,   0,  //  34  0010 1
	 52*3,  60*3,   0,  //  35  0000 0
	    0,     0,   1,  //  36  0101 1.
	 55*3,  54*3,   0,  //  37  0011 1
	    0,     0,  61,  //  38  0101 0.
	    0,     0,  56,  //  39  0110 0.
	 57*3,  58*3,   0,  //  40  0000 1
	    0,     0,   2,  //  41  0100 1.
	    0,     0,  40,  //  42  1000 0.
	 51*3,  62*3,   0,  //  43  0010 0
	    0,     0,  48,  //  44  1001 0.
	 64*3,  63*3,   0,  //  45  0001 0
	 49*3,  53*3,   0,  //  46  0001 1
	    0,     0,  20,  //  47  1000 1.
	    0,     0,  12,  //  48  1001 1.
	 80*3,  83*3,   0,  //  49  0001 10
	    0,     0,  63,  //  50  0011 00.
	 77*3,  75*3,   0,  //  51  0010 00
	 65*3,  73*3,   0,  //  52  0000 00
	 84*3,  66*3,   0,  //  53  0001 11
	    0,     0,  24,  //  54  0011 11.
	    0,     0,  36,  //  55  0011 10.
	    0,     0,   3,  //  56  0011 01.
	 69*3,  87*3,   0,  //  57  0000 10
	 81*3,  79*3,   0,  //  58  0000 11
	 68*3,  71*3,   0,  //  59  0010 11
	 70*3,  78*3,   0,  //  60  0000 01
	 67*3,  76*3,   0,  //  61  0010 10
	 72*3,  74*3,   0,  //  62  0010 01
	 86*3,  85*3,   0,  //  63  0001 01
	 88*3,  82*3,   0,  //  64  0001 00
	   -1,  94*3,   0,  //  65  0000 000
	 95*3,  97*3,   0,  //  66  0001 111
	    0,     0,  33,  //  67  0010 100.
	    0,     0,   9,  //  68  0010 110.
	106*3, 110*3,   0,  //  69  0000 100
	102*3, 116*3,   0,  //  70  0000 010
	    0,     0,   5,  //  71  0010 111.
	    0,     0,  10,  //  72  0010 010.
	 93*3,  89*3,   0,  //  73  0000 001
	    0,     0,   6,  //  74  0010 011.
	    0,     0,  18,  //  75  0010 001.
	    0,     0,  17,  //  76  0010 101.
	    0,     0,  34,  //  77  0010 000.
	113*3, 119*3,   0,  //  78  0000 011
	103*3, 104*3,   0,  //  79  0000 111
	 90*3,  92*3,   0,  //  80  0001 100
	109*3, 107*3,   0,  //  81  0000 110
	117*3, 118*3,   0,  //  82  0001 001
	101*3,  99*3,   0,  //  83  0001 101
	 98*3,  96*3,   0,  //  84  0001 110
	100*3,  91*3,   0,  //  85  0001 011
	114*3, 115*3,   0,  //  86  0001 010
	105*3, 108*3,   0,  //  87  0000 101
	112*3, 111*3,   0,  //  88  0001 000
	121*3, 125*3,   0,  //  89  0000 0011
	    0,     0,  41,  //  90  0001 1000.
	    0,     0,  14,  //  91  0001 0111.
	    0,     0,  21,  //  92  0001 1001.
	124*3, 122*3,   0,  //  93  0000 0010
	120*3, 123*3,   0,  //  94  0000 0001
	    0,     0,  11,  //  95  0001 1110.
	    0,     0,  19,  //  96  0001 1101.
	    0,     0,   7,  //  97  0001 1111.
	    0,     0,  35,  //  98  0001 1100.
	    0,     0,  13,  //  99  0001 1011.
	    0,     0,  50,  // 100  0001 0110.
	    0,     0,  49,  // 101  0001 1010.
	    0,     0,  58,  // 102  0000 0100.
	    0,     0,  37,  // 103  0000 1110.
	    0,     0,  25,  // 104  0000 1111.
	    0,     0,  45,  // 105  0000 1010.
	    0,     0,  57,  // 106  0000 1000.
	    0,     0,  26,  // 107  0000 1101.
	    0,     0,  29,  // 108  0000 1011.
	    0,     0,  38,  // 109  0000 1100.
	    0,     0,  53,  // 110  0000 1001.
	    0,     0,  23,  // 111  0001 0001.
	    0,     0,  43,  // 112  0001 0000.
	    0,     0,  46,  // 113  0000 0110.
	    0,     0,  42,  // 114  0001 0100.
	    0,     0,  22,  // 115  0001 0101.
	    0,     0,  54,  // 116  0000 0101.
	    0,     0,  51,  // 117  0001 0010.
	    0,     0,  15,  // 118  0001 0011.
	    0,     0,  30,  // 119  0000 0111.
	    0,     0,  39,  // 120  0000 0001 0.
	    0,     0,  47,  // 121  0000 0011 0.
	    0,     0,  55,  // 122  0000 0010 1.
	    0,     0,  27,  // 123  0000 0001 1.
	    0,     0,  59,  // 124  0000 0010 0.
	    0,     0,  31   // 125  0000 0011 1.
};

static const int MOTION[] = {
	  1*3,   2*3,   0,  //   0
	  4*3,   3*3,   0,  //   1  0
	    0,     0,   0,  //   2  1.
	  6*3,   5*3,   0,  //   3  01
	  8*3,   7*3,   0,  //   4  00
	    0,     0,  -1,  //   5  011.
	    0,     0,   1,  //   6  010.
	  9*3,  10*3,   0,  //   7  001
	 12*3,  11*3,   0,  //   8  000
	    0,     0,   2,  //   9  0010.
	    0,     0,  -2,  //  10  0011.
	 14*3,  15*3,   0,  //  11  0001
	 16*3,  13*3,   0,  //  12  0000
	 20*3,  18*3,   0,  //  13  0000 1
	    0,     0,   3,  //  14  0001 0.
	    0,     0,  -3,  //  15  0001 1.
	 17*3,  19*3,   0,  //  16  0000 0
	   -1,  23*3,   0,  //  17  0000 00
	 27*3,  25*3,   0,  //  18  0000 11
	 26*3,  21*3,   0,  //  19  0000 01
	 24*3,  22*3,   0,  //  20  0000 10
	 32*3,  28*3,   0,  //  21  0000 011
	 29*3,  31*3,   0,  //  22  0000 101
	   -1,  33*3,   0,  //  23  0000 001
	 36*3,  35*3,   0,  //  24  0000 100
	    0,     0,  -4,  //  25  0000 111.
	 30*3,  34*3,   0,  //  26  0000 010
	    0,     0,   4,  //  27  0000 110.
	    0,     0,  -7,  //  28  0000 0111.
	    0,     0,   5,  //  29  0000 1010.
	 37*3,  41*3,   0,  //  30  0000 0100
	    0,     0,  -5,  //  31  0000 1011.
	    0,     0,   7,  //  32  0000 0110.
	 38*3,  40*3,   0,  //  33  0000 0011
	 42*3,  39*3,   0,  //  34  0000 0101
	    0,     0,  -6,  //  35  0000 1001.
	    0,     0,   6,  //  36  0000 1000.
	 51*3,  54*3,   0,  //  37  0000 0100 0
	 50*3,  49*3,   0,  //  38  0000 0011 0
	 45*3,  46*3,   0,  //  39  0000 0101 1
	 52*3,  47*3,   0,  //  40  0000 0011 1
	 43*3,  53*3,   0,  //  41  0000 0100 1
	 44*3,  48*3,   0,  //  42  0000 0101 0
	    0,     0,  10,  //  43  0000 0100 10.
	    0,     0,   9,  //  44  0000 0101 00.
	    0,     0,   8,  //  45  0000 0101 10.
	    0,     0,  -8,  //  46  0000 0101 11.
	 57*3,  66*3,   0,  //  47  0000 0011 11
	    0,     0,  -9,  //  48  0000 0101 01.
	 60*3,  64*3,   0,  //  49  0000 0011 01
	 56*3,  61*3,   0,  //  50  0000 0011 00
	 55*3,  62*3,   0,  //  51  0000 0100 00
	 58*3,  63*3,   0,  //  52  0000 0011 10
	    0,     0, -10,  //  53  0000 0100 11.
	 59*3,  65*3,   0,  //  54  0000 0100 01
	    0,     0,  12,  //  55  0000 0100 000.
	    0,     0,  16,  //  56  0000 0011 000.
	    0,     0,  13,  //  57  0000 0011 110.
	    0,     0,  14,  //  58  0000 0011 100.
	    0,     0,  11,  //  59  0000 0100 010.
	    0,     0,  15,  //  60  0000 0011 010.
	    0,     0, -16,  //  61  0000 0011 001.
	    0,     0, -12,  //  62  0000 0100 001.
	    0,     0, -14,  //  63  0000 0011 101.
	    0,     0, -15,  //  64  0000 0011 011.
	    0,     0, -11,  //  65  0000 0100 011.
	    0,     0, -13   //  66  0000 0011 111.
};

static const int DCT_DC_SIZE_LUMINANCE[] = {
	  2*3,   1*3, 0,  //   0
	  6*3,   5*3, 0,  //   1  1
	  3*3,   4*3, 0,  //   2  0
	    0,     0, 1,  //   3  00.
	    0,     0, 2,  //   4  01.
	  9*3,   8*3, 0,  //   5  11
	  7*3,  10*3, 0,  //   6  10
	    0,     0, 0,  //   7  100.
	 12*3,  11*3, 0,  //   8  111
	    0,     0, 4,  //   9  110.
	    0,     0, 3,  //  10  101.
	 13*3,  14*3, 0,  //  11  1111
	    0,     0, 5,  //  12  1110.
	    0,     0, 6,  //  13  1111 0.
	 16*3,  15*3, 0,  //  14  1111 1
	 17*3,    -1, 0,  //  15  1111 11
	    0,     0, 7,  //  16  1111 10.
	    0,     0, 8   //  17  1111 110.
};

static const int DCT_DC_SIZE_CHROMINANCE[] = {
	  2*3,   1*3, 0,  //   0
	  4*3,   3*3, 0,  //   1  1
	  6*3,   5*3, 0,  //   2  0
	  8*3,   7*3, 0,  //   3  11
	    0,     0, 2,  //   4  10.
	    0,     0, 1,  //   5  01.
	    0,     0, 0,  //   6  00.
	 10*3,   9*3, 0,  //   7  111
	    0,     0, 3,  //   8  110.
	 12*3,  11*3, 0,  //   9  1111
	    0,     0, 4,  //  10  1110.
	 14*3,  13*3, 0,  //  11  1111 1
	    0,     0, 5,  //  12  1111 0.
	 16*3,  15*3, 0,  //  13  1111 11
	    0,     0, 6,  //  14  1111 10.
	 17*3,    -1, 0,  //  15  1111 111
	    0,     0, 7,  //  16  1111 110.
	    0,     0, 8   //  17  1111 1110.
};

//  dct_coeff bitmap:
//    0xff00  run
//    0x00ff  level

//  Decoded values are unsigned. Sign bit follows in the stream.

//  Interpretation of the value 0x0001
//    for dc_coeff_first:  run=0, level=1
//    for dc_coeff_next:   If the next bit is 1: run=0, level=1
//                         If the next bit is 0: end_of_block

//  escape decodes as 0xffff.

static const int DCT_COEFF[] = {
	  1*3,   2*3,      0,  //   0
	  4*3,   3*3,      0,  //   1  0
	    0,     0, 0x0001,  //   2  1.
	  7*3,   8*3,      0,  //   3  01
	  6*3,   5*3,      0,  //   4  00
	 13*3,   9*3,      0,  //   5  001
	 11*3,  10*3,      0,  //   6  000
	 14*3,  12*3,      0,  //   7  010
	    0,     0, 0x0101,  //   8  011.
	 20*3,  22*3,      0,  //   9  0011
	 18*3,  21*3,      0,  //  10  0001
	 16*3,  19*3,      0,  //  11  0000
	    0,     0, 0x0201,  //  12  0101.
	 17*3,  15*3,      0,  //  13  0010
	    0,     0, 0x0002,  //  14  0100.
	    0,     0, 0x0003,  //  15  0010 1.
	 27*3,  25*3,      0,  //  16  0000 0
	 29*3,  31*3,      0,  //  17  0010 0
	 24*3,  26*3,      0,  //  18  0001 0
	 32*3,  30*3,      0,  //  19  0000 1
	    0,     0, 0x0401,  //  20  0011 0.
	 23*3,  28*3,      0,  //  21  0001 1
	    0,     0, 0x0301,  //  22  0011 1.
	    0,     0, 0x0102,  //  23  0001 10.
	    0,     0, 0x0701,  //  24  0001 00.
	    0,     0, 0xffff,  //  25  0000 01. -- escape
	    0,     0, 0x0601,  //  26  0001 01.
	 37*3,  36*3,      0,  //  27  0000 00
	    0,     0, 0x0501,  //  28  0001 11.
	 35*3,  34*3,      0,  //  29  0010 00
	 39*3,  38*3,      0,  //  30  0000 11
	 33*3,  42*3,      0,  //  31  0010 01
	 40*3,  41*3,      0,  //  32  0000 10
	 52*3,  50*3,      0,  //  33  0010 010
	 54*3,  53*3,      0,  //  34  0010 001
	 48*3,  49*3,      0,  //  35  0010 000
	 43*3,  45*3,      0,  //  36  0000 001
	 46*3,  44*3,      0,  //  37  0000 000
	    0,     0, 0x0801,  //  38  0000 111.
	    0,     0, 0x0004,  //  39  0000 110.
	    0,     0, 0x0202,  //  40  0000 100.
	    0,     0, 0x0901,  //  41  0000 101.
	 51*3,  47*3,      0,  //  42  0010 011
	 55*3,  57*3,      0,  //  43  0000 0010
	 60*3,  56*3,      0,  //  44  0000 0001
	 59*3,  58*3,      0,  //  45  0000 0011
	 61*3,  62*3,      0,  //  46  0000 0000
	    0,     0, 0x0a01,  //  47  0010 0111.
	    0,     0, 0x0d01,  //  48  0010 0000.
	    0,     0, 0x0006,  //  49  0010 0001.
	    0,     0, 0x0103,  //  50  0010 0101.
	    0,     0, 0x0005,  //  51  0010 0110.
	    0,     0, 0x0302,  //  52  0010 0100.
	    0,     0, 0x0b01,  //  53  0010 0011.
	    0,     0, 0x0c01,  //  54  0010 0010.
	 76*3,  75*3,      0,  //  55  0000 0010 0
	 67*3,  70*3,      0,  //  56  0000 0001 1
	 73*3,  71*3,      0,  //  57  0000 0010 1
	 78*3,  74*3,      0,  //  58  0000 0011 1
	 72*3,  77*3,      0,  //  59  0000 0011 0
	 69*3,  64*3,      0,  //  60  0000 0001 0
	 68*3,  63*3,      0,  //  61  0000 0000 0
	 66*3,  65*3,      0,  //  62  0000 0000 1
	 81*3,  87*3,      0,  //  63  0000 0000 01
	 91*3,  80*3,      0,  //  64  0000 0001 01
	 82*3,  79*3,      0,  //  65  0000 0000 11
	 83*3,  86*3,      0,  //  66  0000 0000 10
	 93*3,  92*3,      0,  //  67  0000 0001 10
	 84*3,  85*3,      0,  //  68  0000 0000 00
	 90*3,  94*3,      0,  //  69  0000 0001 00
	 88*3,  89*3,      0,  //  70  0000 0001 11
	    0,     0, 0x0203,  //  71  0000 0010 11.
	    0,     0, 0x0104,  //  72  0000 0011 00.
	    0,     0, 0x0007,  //  73  0000 0010 10.
	    0,     0, 0x0402,  //  74  0000 0011 11.
	    0,     0, 0x0502,  //  75  0000 0010 01.
	    0,     0, 0x1001,  //  76  0000 0010 00.
	    0,     0, 0x0f01,  //  77  0000 0011 01.
	    0,     0, 0x0e01,  //  78  0000 0011 10.
	105*3, 107*3,      0,  //  79  0000 0000 111
	111*3, 114*3,      0,  //  80  0000 0001 011
	104*3,  97*3,      0,  //  81  0000 0000 010
	125*3, 119*3,      0,  //  82  0000 0000 110
	 96*3,  98*3,      0,  //  83  0000 0000 100
	   -1, 123*3,      0,  //  84  0000 0000 000
	 95*3, 101*3,      0,  //  85  0000 0000 001
	106*3, 121*3,      0,  //  86  0000 0000 101
	 99*3, 102*3,      0,  //  87  0000 0000 011
	113*3, 103*3,      0,  //  88  0000 0001 110
	112*3, 116*3,      0,  //  89  0000 0001 111
	110*3, 100*3,      0,  //  90  0000 0001 000
	124*3, 115*3,      0,  //  91  0000 0001 010
	117*3, 122*3,      0,  //  92  0000 0001 101
	109*3, 118*3,      0,  //  93  0000 0001 100
	120*3, 108*3,      0,  //  94  0000 0001 001
	127*3, 136*3,      0,  //  95  0000 0000 0010
	139*3, 140*3,      0,  //  96  0000 0000 1000
	130*3, 126*3,      0,  //  97  0000 0000 0101
	145*3, 146*3,      0,  //  98  0000 0000 1001
	128*3, 129*3,      0,  //  99  0000 0000 0110
	    0,     0, 0x0802,  // 100  0000 0001 0001.
	132*3, 134*3,      0,  // 101  0000 0000 0011
	155*3, 154*3,      0,  // 102  0000 0000 0111
	    0,     0, 0x0008,  // 103  0000 0001 1101.
	137*3, 133*3,      0,  // 104  0000 0000 0100
	143*3, 144*3,      0,  // 105  0000 0000 1110
	151*3, 138*3,      0,  // 106  0000 0000 1010
	142*3, 141*3,      0,  // 107  0000 0000 1111
	    0,     0, 0x000a,  // 108  0000 0001 0011.
	    0,     0, 0x0009,  // 109  0000 0001 1000.
	    0,     0, 0x000b,  // 110  0000 0001 0000.
	    0,     0, 0x1501,  // 111  0000 0001 0110.
	    0,     0, 0x0602,  // 112  0000 0001 1110.
	    0,     0, 0x0303,  // 113  0000 0001 1100.
	    0,     0, 0x1401,  // 114  0000 0001 0111.
	    0,     0, 0x0702,  // 115  0000 0001 0101.
	    0,     0, 0x1101,  // 116  0000 0001 1111.
	    0,     0, 0x1201,  // 117  0000 0001 1010.
	    0,     0, 0x1301,  // 118  0000 0001 1001.
	148*3, 152*3,      0,  // 119  0000 0000 1101
	    0,     0, 0x0403,  // 120  0000 0001 0010.
	153*3, 150*3,      0,  // 121  0000 0000 1011
	    0,     0, 0x0105,  // 122  0000 0001 1011.
	131*3, 135*3,      0,  // 123  0000 0000 0001
	    0,     0, 0x0204,  // 124  0000 0001 0100.
	149*3, 147*3,      0,  // 125  0000 0000 1100
	172*3, 173*3,      0,  // 126  0000 0000 0101 1
	162*3, 158*3,      0,  // 127  0000 0000 0010 0
	170*3, 161*3,      0,  // 128  0000 0000 0110 0
	168*3, 166*3,      0,  // 129  0000 0000 0110 1
	157*3, 179*3,      0,  // 130  0000 0000 0101 0
	169*3, 167*3,      0,  // 131  0000 0000 0001 0
	174*3, 171*3,      0,  // 132  0000 0000 0011 0
	178*3, 177*3,      0,  // 133  0000 0000 0100 1
	156*3, 159*3,      0,  // 134  0000 0000 0011 1
	164*3, 165*3,      0,  // 135  0000 0000 0001 1
	183*3, 182*3,      0,  // 136  0000 0000 0010 1
	175*3, 176*3,      0,  // 137  0000 0000 0100 0
	    0,     0, 0x0107,  // 138  0000 0000 1010 1.
	    0,     0, 0x0a02,  // 139  0000 0000 1000 0.
	    0,     0, 0x0902,  // 140  0000 0000 1000 1.
	    0,     0, 0x1601,  // 141  0000 0000 1111 1.
	    0,     0, 0x1701,  // 142  0000 0000 1111 0.
	    0,     0, 0x1901,  // 143  0000 0000 1110 0.
	    0,     0, 0x1801,  // 144  0000 0000 1110 1.
	    0,     0, 0x0503,  // 145  0000 0000 1001 0.
	    0,     0, 0x0304,  // 146  0000 0000 1001 1.
	    0,     0, 0x000d,  // 147  0000 0000 1100 1.
	    0,     0, 0x000c,  // 148  0000 0000 1101 0.
	    0,     0, 0x000e,  // 149  0000 0000 1100 0.
	    0,     0, 0x000f,  // 150  0000 0000 1011 1.
	    0,     0, 0x0205,  // 151  0000 0000 1010 0.
	    0,     0, 0x1a01,  // 152  0000 0000 1101 1.
	    0,     0, 0x0106,  // 153  0000 0000 1011 0.
	180*3, 181*3,      0,  // 154  0000 0000 0111 1
	160*3, 163*3,      0,  // 155  0000 0000 0111 0
	196*3, 199*3,      0,  // 156  0000 0000 0011 10
	    0,     0, 0x001b,  // 157  0000 0000 0101 00.
	203*3, 185*3,      0,  // 158  0000 0000 0010 01
	202*3, 201*3,      0,  // 159  0000 0000 0011 11
	    0,     0, 0x0013,  // 160  0000 0000 0111 00.
	    0,     0, 0x0016,  // 161  0000 0000 0110 01.
	197*3, 207*3,      0,  // 162  0000 0000 0010 00
	    0,     0, 0x0012,  // 163  0000 0000 0111 01.
	191*3, 192*3,      0,  // 164  0000 0000 0001 10
	188*3, 190*3,      0,  // 165  0000 0000 0001 11
	    0,     0, 0x0014,  // 166  0000 0000 0110 11.
	184*3, 194*3,      0,  // 167  0000 0000 0001 01
	    0,     0, 0x0015,  // 168  0000 0000 0110 10.
	186*3, 193*3,      0,  // 169  0000 0000 0001 00
	    0,     0, 0x0017,  // 170  0000 0000 0110 00.
	204*3, 198*3,      0,  // 171  0000 0000 0011 01
	    0,     0, 0x0019,  // 172  0000 0000 0101 10.
	    0,     0, 0x0018,  // 173  0000 0000 0101 11.
	200*3, 205*3,      0,  // 174  0000 0000 0011 00
	    0,     0, 0x001f,  // 175  0000 0000 0100 00.
	    0,     0, 0x001e,  // 176  0000 0000 0100 01.
	    0,     0, 0x001c,  // 177  0000 0000 0100 11.
	    0,     0, 0x001d,  // 178  0000 0000 0100 10.
	    0,     0, 0x001a,  // 179  0000 0000 0101 01.
	    0,     0, 0x0011,  // 180  0000 0000 0111 10.
	    0,     0, 0x0010,  // 181  0000 0000 0111 11.
	189*3, 206*3,      0,  // 182  0000 0000 0010 11
	187*3, 195*3,      0,  // 183  0000 0000 0010 10
	218*3, 211*3,      0,  // 184  0000 0000 0001 010
	    0,     0, 0x0025,  // 185  0000 0000 0010 011.
	215*3, 216*3,      0,  // 186  0000 0000 0001 000
	    0,     0, 0x0024,  // 187  0000 0000 0010 100.
	210*3, 212*3,      0,  // 188  0000 0000 0001 110
	    0,     0, 0x0022,  // 189  0000 0000 0010 110.
	213*3, 209*3,      0,  // 190  0000 0000 0001 111
	221*3, 222*3,      0,  // 191  0000 0000 0001 100
	219*3, 208*3,      0,  // 192  0000 0000 0001 101
	217*3, 214*3,      0,  // 193  0000 0000 0001 001
	223*3, 220*3,      0,  // 194  0000 0000 0001 011
	    0,     0, 0x0023,  // 195  0000 0000 0010 101.
	    0,     0, 0x010b,  // 196  0000 0000 0011 100.
	    0,     0, 0x0028,  // 197  0000 0000 0010 000.
	    0,     0, 0x010c,  // 198  0000 0000 0011 011.
	    0,     0, 0x010a,  // 199  0000 0000 0011 101.
	    0,     0, 0x0020,  // 200  0000 0000 0011 000.
	    0,     0, 0x0108,  // 201  0000 0000 0011 111.
	    0,     0, 0x0109,  // 202  0000 0000 0011 110.
	    0,     0, 0x0026,  // 203  0000 0000 0010 010.
	    0,     0, 0x010d,  // 204  0000 0000 0011 010.
	    0,     0, 0x010e,  // 205  0000 0000 0011 001.
	    0,     0, 0x0021,  // 206  0000 0000 0010 111.
	    0,     0, 0x0027,  // 207  0000 0000 0010 001.
	    0,     0, 0x1f01,  // 208  0000 0000 0001 1011.
	    0,     0, 0x1b01,  // 209  0000 0000 0001 1111.
	    0,     0, 0x1e01,  // 210  0000 0000 0001 1100.
	    0,     0, 0x1002,  // 211  0000 0000 0001 0101.
	    0,     0, 0x1d01,  // 212  0000 0000 0001 1101.
	    0,     0, 0x1c01,  // 213  0000 0000 0001 1110.
	    0,     0, 0x010f,  // 214  0000 0000 0001 0011.
	    0,     0, 0x0112,  // 215  0000 0000 0001 0000.
	    0,     0, 0x0111,  // 216  0000 0000 0001 0001.
	    0,     0, 0x0110,  // 217  0000 0000 0001 0010.
	    0,     0, 0x0603,  // 218  0000 0000 0001 0100.
	    0,     0, 0x0b02,  // 219  0000 0000 0001 1010.
	    0,     0, 0x0e02,  // 220  0000 0000 0001 0111.
	    0,     0, 0x0d02,  // 221  0000 0000 0001 1000.
	    0,     0, 0x0c02,  // 222  0000 0000 0001 1001.
	    0,     0, 0x0f02   // 223  0000 0000 0001 0110.
};

static const int PICTURE_TYPE_INTRA = 1;
static const int PICTURE_TYPE_PREDICTIVE = 2;
static const int PICTURE_TYPE_B = 3;

static const int START_SEQUENCE = 0xB3;
static const int START_SLICE_FIRST = 0x01;
static const int START_SLICE_LAST = 0xAF;
static const int START_PICTURE = 0x00;
static const int START_EXTENSION = 0xB5;
static const int START_USER_DATA = 0xB2;


typedef struct mpeg1_planes_t {
	uint8_t *y;
	uint8_t *cr;
	uint8_t *cb;
} mpeg1_planes_t;

typedef struct mpeg1_decoder_t {
	float frame_rate;
	int width;
	int height;
	int mb_width;
	int mb_height;
	int mb_size;

	int coded_width;
	int coded_height;
	int coded_size;

	int half_width;
	int half_height;

	int picture_type;
	int full_pel_forward;
	int forward_f_code;
	int forward_r_size;
	int forward_f;

	int has_sequence_header;

	int quantizer_scale;
	int slice_begin;
	int macroblock_address;

	int mb_row;
	int mb_col;

	int macroblock_type;
	int macroblock_intra;
	int macroblock_motion_fw;

	int motion_fw_h;
	int motion_fw_v;
	int motion_fw_h_prev;
	int motion_fw_v_prev;

	int dc_predictor_y;
	int dc_predictor_cr;
	int dc_predictor_cb;

	bit_buffer_t *bits;

	mpeg1_planes_t planes_current;
	mpeg1_planes_t planes_forward;

	int block_data[64];
	uint8_t intra_quant_matrix[64];
	uint8_t non_intra_quant_matrix[64];
} mpeg1_decoder_t;


void decode_sequence_header(mpeg1_decoder_t *self);
void decode_picture(mpeg1_decoder_t *self);
void init_buffers(mpeg1_decoder_t *self);
void decode_slice(mpeg1_decoder_t *self, int slice);
void decode_macroblock(mpeg1_decoder_t *self);
void decode_motion_vectors(mpeg1_decoder_t *self);
void copy_macroblock(mpeg1_decoder_t *self, int motion_h, int motion_v, uint8_t *s_y, uint8_t *s_cr, uint8_t *s_cb);
void decode_block(mpeg1_decoder_t *self, int block);

void copy_block_to_destination(int *block, uint8_t *dest, int index, int scan);
void add_block_to_destination(int *block, uint8_t *dest, int index, int scan);
void copy_value_to_destination(int value, uint8_t *dest, int index, int scan);
void add_value_to_destination(int value, uint8_t *dest, int index, int scan);
void idct(int *block);
void zero_block_data(mpeg1_decoder_t *self);
int read_huffman(bit_buffer_t *bits, const int *code_table);




// -----------------------------------------------------------------------------
// Public interface

mpeg1_decoder_t *mpeg1_decoder_create(unsigned int buffer_size, bit_buffer_mode_t buffer_mode) {
	mpeg1_decoder_t *self = malloc(sizeof(mpeg1_decoder_t));
	self->bits = bit_buffer_create(buffer_size, buffer_mode);
	return self;
}

void mpeg1_decoder_destroy(mpeg1_decoder_t *self) {
	bit_buffer_destroy(self->bits);

	if (self->has_sequence_header) {
		free(self->planes_current.y);
		free(self->planes_current.cr);
		free(self->planes_current.cb);

		free(self->planes_forward.y);
		free(self->planes_forward.cr);
		free(self->planes_forward.cb);
	}

	free(self);
}

void *mpeg1_decoder_get_write_ptr(mpeg1_decoder_t *self, unsigned int byte_size) {
	return bit_buffer_get_write_ptr(self->bits, byte_size);
}

int mpeg1_decoder_get_index(mpeg1_decoder_t *self) {
	return bit_buffer_get_index(self->bits);
}

void mpeg1_decoder_set_index(mpeg1_decoder_t *self, unsigned int index) {
	bit_buffer_set_index(self->bits, index);
}

void mpeg1_decoder_did_write(mpeg1_decoder_t *self, unsigned int byte_size) {
	bit_buffer_did_write(self->bits, byte_size);
	if (!self->has_sequence_header) {
		if (bit_buffer_find_start_code(self->bits, START_SEQUENCE) != -1) {
			decode_sequence_header(self);
		}
	}
}

int mpeg1_decoder_has_sequence_header(mpeg1_decoder_t *self) {
	return self->has_sequence_header;
}

float mpeg1_decoder_get_frame_rate(mpeg1_decoder_t *self) {
	return self->frame_rate;
}

int mpeg1_decoder_get_coded_size(mpeg1_decoder_t *self) {
	return self->coded_size;
}

int mpeg1_decoder_get_width(mpeg1_decoder_t *self) {
	return self->width;
}

int mpeg1_decoder_get_height(mpeg1_decoder_t *self) {
	return self->height;
}

void *mpeg1_decoder_get_y_ptr(mpeg1_decoder_t *self) {
	return self->planes_forward.y;
}

void *mpeg1_decoder_get_cr_ptr(mpeg1_decoder_t *self) {
	return self->planes_forward.cr;
}

void *mpeg1_decoder_get_cb_ptr(mpeg1_decoder_t *self) {
	return self->planes_forward.cb;
}

bool mpeg1_decoder_decode(mpeg1_decoder_t *self) {
	if (!self->has_sequence_header) {
		return false;
	}

	if (bit_buffer_find_start_code(self->bits, START_PICTURE) == -1) {
		return false;
	}

	decode_picture(self);
	return true;
}




// -----------------------------------------------------------------------------
// Private methods

void decode_sequence_header(mpeg1_decoder_t *self) {
	int previous_width = self->width; 
	int previous_height = self->height;

	self->width = bit_buffer_read(self->bits, 12);
	self->height = bit_buffer_read(self->bits, 12);

	// skip pixel aspect ratio
	bit_buffer_skip(self->bits, 4);

	self->frame_rate = PICTURE_RATE[bit_buffer_read(self->bits, 4)];

	// skip bitRate, marker, bufferSize and constrained bit
	bit_buffer_skip(self->bits, 18 + 1 + 10 + 1);

	if (bit_buffer_read(self->bits, 1)) { // load custom intra quant matrix?
		for (int i = 0; i < 64; i++) {
			self->intra_quant_matrix[ZIG_ZAG[i]] = bit_buffer_read(self->bits, 8);
		}
	}
	else {
		memcpy(self->intra_quant_matrix, DEFAULT_INTRA_QUANT_MATRIX, 64);
	}

	if (bit_buffer_read(self->bits, 1)) { // load custom non intra quant matrix?
		for (int i = 0; i < 64; i++) {
			int idx = ZIG_ZAG[i];
			self->non_intra_quant_matrix[idx] = bit_buffer_read(self->bits, 8);
		}
	}
	else {
		memcpy(self->non_intra_quant_matrix, DEFAULT_NON_INTRA_QUANT_MATRIX, 64);
	}

	if (self->has_sequence_header) {
		if (self->width == previous_width && self->height == previous_height) {
			// We already had a sequence header with the same width/height;
			// nothing else to do here.
			return;
		}

		// We had a sequence header but with different dimensions;
		// delete the previous planes and allocate new.
		free(self->planes_current.y);
		free(self->planes_current.cr);
		free(self->planes_current.cb);

		free(self->planes_forward.y);
		free(self->planes_forward.cr);
		free(self->planes_forward.cb);
	}

	self->mb_width = (self->width + 15) >> 4;
	self->mb_height = (self->height + 15) >> 4;
	self->mb_size = self->mb_width * self->mb_height;

	self->coded_width = self->mb_width << 4;
	self->coded_height = self->mb_height << 4;
	self->coded_size = self->coded_width * self->coded_height;

	self->half_width = self->mb_width << 3;
	self->half_height = self->mb_height << 3;

	self->planes_current.y = (uint8_t*)malloc(self->coded_size);
	self->planes_current.cr = (uint8_t*)malloc(self->coded_size >> 2);
	self->planes_current.cb = (uint8_t*)malloc(self->coded_size >> 2);

	self->planes_forward.y = (uint8_t*)malloc(self->coded_size);
	self->planes_forward.cr = (uint8_t*)malloc(self->coded_size >> 2);
	self->planes_forward.cb = (uint8_t*)malloc(self->coded_size >> 2);

	self->has_sequence_header = true;
}


void decode_picture(mpeg1_decoder_t *self) {
	bit_buffer_skip(self->bits, 10); // skip temporalReference
	self->picture_type = bit_buffer_read(self->bits, 3);
	bit_buffer_skip(self->bits, 16); // skip vbv_delay

	// Skip B and D frames or unknown coding type
	if (self->picture_type <= 0 || self->picture_type >= PICTURE_TYPE_B) {
		return;
	}

	// full_pel_forward, forward_f_code
	if (self->picture_type == PICTURE_TYPE_PREDICTIVE) {
		self->full_pel_forward = bit_buffer_read(self->bits, 1);
		self->forward_f_code = bit_buffer_read(self->bits, 3);
		if (self->forward_f_code == 0) {
			// Ignore picture with zero self->forward_f_code
			return;
		}
		self->forward_r_size = self->forward_f_code - 1;
		self->forward_f = 1 << self->forward_r_size;
	}

	int code = 0;
	do {
		code = bit_buffer_find_next_start_code(self->bits);
	} while (code == START_EXTENSION || code == START_USER_DATA);


	while (code >= START_SLICE_FIRST && code <= START_SLICE_LAST) {
		decode_slice(self, code & 0x000000FF);
		code = bit_buffer_find_next_start_code(self->bits);
	}

	if (code != -1) {
		// We found the next start code; rewind 32self->bits and let the main loop
		// handle it.
		bit_buffer_rewind(self->bits, 32);
	}

	// If this is a reference picutre then rotate the prediction pointers
	if (
		self->picture_type == PICTURE_TYPE_INTRA ||
		self->picture_type == PICTURE_TYPE_PREDICTIVE
	) {
		mpeg1_planes_t temp = self->planes_forward;
		self->planes_forward = self->planes_current;
		self->planes_current = temp;
	}
}


// Slice Layer

void decode_slice(mpeg1_decoder_t *self, int slice) {
	self->slice_begin = true;
	self->macroblock_address = (slice - 1) * self->mb_width - 1;

	// Reset motion vectors and DC predictors
	self->motion_fw_h = self->motion_fw_h_prev = 0;
	self->motion_fw_v = self->motion_fw_v_prev = 0;
	self->dc_predictor_y  = 128;
	self->dc_predictor_cr = 128;
	self->dc_predictor_cb = 128;

	self->quantizer_scale = bit_buffer_read(self->bits, 5);

	// skip extra self->bits
	while (bit_buffer_read(self->bits, 1)) {
		bit_buffer_skip(self->bits, 8);
	}

	do {
		decode_macroblock(self);
	} while (!bit_buffer_next_bytes_are_start_code(self->bits));
};


// Macroblock Layer

void decode_macroblock(mpeg1_decoder_t *self) {
	// Decode self->macroblock_address_increment
	int increment = 0;
	int x = 0;
	int t = read_huffman(self->bits, MACROBLOCK_ADDRESS_INCREMENT);

	while (t == 34) {
		// macroblock_stuffing
		x = 1;
		t = read_huffman(self->bits, MACROBLOCK_ADDRESS_INCREMENT);
	}
	while (t == 35) {
		// macroblock_escape
		increment += 33;
		x =
		t = read_huffman(self->bits, MACROBLOCK_ADDRESS_INCREMENT);
	}
	increment += t;

	// Process any skipped macroblocks
	if (self->slice_begin) {
		// The first self->macroblock_address_increment of each slice is relative
		// to beginning of the preverious row, not the preverious macroblock
		self->slice_begin = false;
		self->macroblock_address += increment;
	}
	else {
		if (self->macroblock_address + increment >= self->mb_size) {
			// Illegal (too large) self->macroblock_address_increment
			// abort();
			return;
		}
		if (increment > 1) {
			// Skipped macroblocks reset DC predictors
			self->dc_predictor_y  = 128;
			self->dc_predictor_cr = 128;
			self->dc_predictor_cb = 128;

			// Skipped macroblocks in P-pictures reset motion vectors
			if (self->picture_type == PICTURE_TYPE_PREDICTIVE) {
				self->motion_fw_h = self->motion_fw_h_prev = 0;
				self->motion_fw_v = self->motion_fw_v_prev = 0;
			}
		}

		// Predict skipped macroblocks
		while (increment > 1) {
			self->macroblock_address++;
			self->mb_row = (self->macroblock_address / self->mb_width)|0;
			self->mb_col = self->macroblock_address % self->mb_width;
			copy_macroblock(
				self,
				self->motion_fw_h, self->motion_fw_v,
				self->planes_forward.y, self->planes_forward.cr, self->planes_forward.cb
			);
			increment--;
		}
		self->macroblock_address++;
	}

	self->mb_row = (self->macroblock_address / self->mb_width)|0;
	self->mb_col = self->macroblock_address % self->mb_width;

	// Process the current macroblock
	// static const s16 *mbTable = MACROBLOCK_TYPE[self->picture_type];
	// macroblock_type = read_huffman(self->bits, mbTable);
	if (self->picture_type == PICTURE_TYPE_INTRA) {
		self->macroblock_type = read_huffman(self->bits, MACROBLOCK_TYPE_INTRA);
	}
	else if (self->picture_type == PICTURE_TYPE_PREDICTIVE) {
		self->macroblock_type = read_huffman(self->bits, MACROBLOCK_TYPE_PREDICTIVE);
	}
	else {
		// Unhandled picture type
		// abort();
	}
	self->macroblock_intra = (self->macroblock_type & 0x01);
	self->macroblock_motion_fw = (self->macroblock_type & 0x08);

	// Quantizer scale
	if ((self->macroblock_type & 0x10) != 0) {
		self->quantizer_scale = bit_buffer_read(self->bits, 5);
	}

	if (self->macroblock_intra) {
		// Intra-coded macroblocks reset motion vectors
		self->motion_fw_h = self->motion_fw_h_prev = 0;
		self->motion_fw_v = self->motion_fw_v_prev = 0;
	}
	else {
		// Non-intra macroblocks reset DC predictors
		self->dc_predictor_y = 128;
		self->dc_predictor_cr = 128;
		self->dc_predictor_cb = 128;

		decode_motion_vectors(self);
		copy_macroblock(
			self,
			self->motion_fw_h, self->motion_fw_v,
			self->planes_forward.y, self->planes_forward.cr, self->planes_forward.cb
		);
	}

	// Decode blocks
	int cbp = ((self->macroblock_type & 0x02) != 0)
		? read_huffman(self->bits, CODE_BLOCK_PATTERN)
		: (self->macroblock_intra ? 0x3f : 0);

	for (int block = 0, mask = 0x20; block < 6; block++) {
		if ((cbp & mask) != 0) {
			decode_block(self, block);
		}
		mask >>= 1;
	}
};


void decode_motion_vectors(mpeg1_decoder_t *self) {
	int code, d, r = 0;

	// Forward
	if (self->macroblock_motion_fw) {
		// Horizontal forward
		code = read_huffman(self->bits, MOTION);
		if ((code != 0) && (self->forward_f != 1)) {
			r = bit_buffer_read(self->bits, self->forward_r_size);
			d = ((abs(code) - 1) << self->forward_r_size) + r + 1;
			if (code < 0) {
				d = -d;
			}
		}
		else {
			d = code;
		}

		self->motion_fw_h_prev += d;
		if (self->motion_fw_h_prev > (self->forward_f << 4) - 1) {
			self->motion_fw_h_prev -= self->forward_f << 5;
		}
		else if (self->motion_fw_h_prev < ((-self->forward_f) << 4)) {
			self->motion_fw_h_prev += self->forward_f << 5;
		}

		self->motion_fw_h = self->motion_fw_h_prev;
		if (self->full_pel_forward) {
			self->motion_fw_h <<= 1;
		}

		// Vertical forward
		code = read_huffman(self->bits, MOTION);
		if ((code != 0) && (self->forward_f != 1)) {
			r = bit_buffer_read(self->bits, self->forward_r_size);
			d = ((abs(code) - 1) << self->forward_r_size) + r + 1;
			if (code < 0) {
				d = -d;
			}
		}
		else {
			d = code;
		}

		self->motion_fw_v_prev += d;
		if (self->motion_fw_v_prev > (self->forward_f << 4) - 1) {
			self->motion_fw_v_prev -= self->forward_f << 5;
		}
		else if (self->motion_fw_v_prev < ((-self->forward_f) << 4)) {
			self->motion_fw_v_prev += self->forward_f << 5;
		}

		self->motion_fw_v = self->motion_fw_v_prev;
		if (self->full_pel_forward) {
			self->motion_fw_v <<= 1;
		}
	}
	else if (self->picture_type == PICTURE_TYPE_PREDICTIVE) {
		// No motion information in P-picture, reset vectors
		self->motion_fw_h = self->motion_fw_h_prev = 0;
		self->motion_fw_v = self->motion_fw_v_prev = 0;
	}
}


void copy_macroblock(mpeg1_decoder_t *self, int motion_h, int motion_v, uint8_t *s_y, uint8_t *s_cr, uint8_t *s_cb) {
	int
		width, scan,
		H, V,
		src, dest, last;
	bool odd_h, odd_v;

	// We use 32bit writes here
	int *d_y = (int*)self->planes_current.y;
	int *d_cb = (int*)self->planes_current.cb;
	int *d_cr = (int*)self->planes_current.cr;

	// Luminance
	width = self->coded_width;
	scan = width - 16;

	H = motion_h >> 1;
	V = motion_v >> 1;
	odd_h = (motion_h & 1) == 1;
	odd_v = (motion_v & 1) == 1;

	src = ((self->mb_row << 4) + V) * width + (self->mb_col << 4) + H;
	dest = (self->mb_row * width + self->mb_col) << 2;
	last = dest + (width << 2);

	int x, y1, y2, y;
	if (odd_h) {
		if (odd_v) {
			while (dest < last) {
				y1 = s_y[src] + s_y[src+width]; src++;
				for (x = 0; x < 4; x++) {
					y2 = s_y[src] + s_y[src+width]; src++;
					y = (((y1 + y2 + 2) >> 2) & 0xff);

					y1 = s_y[src] + s_y[src+width]; src++;
					y |= (((y1 + y2 + 2) << 6) & 0xff00);

					y2 = s_y[src] + s_y[src+width]; src++;
					y |= (((y1 + y2 + 2) << 14) & 0xff0000);

					y1 = s_y[src] + s_y[src+width]; src++;
					y |= (((y1 + y2 + 2) << 22) & 0xff000000);

					d_y[dest++] = y;
				}
				dest += scan >> 2; src += scan-1;
			}
		}
		else {
			while (dest < last) {
				y1 = s_y[src++];
				for (x = 0; x < 4; x++) {
					y2 = s_y[src++];
					y = (((y1 + y2 + 1) >> 1) & 0xff);

					y1 = s_y[src++];
					y |= (((y1 + y2 + 1) << 7) & 0xff00);

					y2 = s_y[src++];
					y |= (((y1 + y2 + 1) << 15) & 0xff0000);

					y1 = s_y[src++];
					y |= (((y1 + y2 + 1) << 23) & 0xff000000);

					d_y[dest++] = y;
				}
				dest += scan >> 2; src += scan-1;
			}
		}
	}
	else {
		if (odd_v) {
			while (dest < last) {
				for (x = 0; x < 4; x++) {
					y = (((s_y[src] + s_y[src+width] + 1) >> 1) & 0xff); src++;
					y |= (((s_y[src] + s_y[src+width] + 1) << 7) & 0xff00); src++;
					y |= (((s_y[src] + s_y[src+width] + 1) << 15) & 0xff0000); src++;
					y |= (((s_y[src] + s_y[src+width] + 1) << 23) & 0xff000000); src++;

					d_y[dest++] = y;
				}
				dest += scan >> 2; src += scan;
			}
		}
		else {
			while (dest < last) {
				for (x = 0; x < 4; x++) {
					y = s_y[src]; src++;
					y |= s_y[src] << 8; src++;
					y |= s_y[src] << 16; src++;
					y |= s_y[src] << 24; src++;

					d_y[dest++] = y;
				}
				dest += scan >> 2; src += scan;
			}
		}
	}

	// Chrominance

	width = self->half_width;
	scan = width - 8;

	H = (motion_h/2) >> 1;
	V = (motion_v/2) >> 1;
	odd_h = ((motion_h/2) & 1) == 1;
	odd_v = ((motion_v/2) & 1) == 1;

	src = ((self->mb_row << 3) + V) * width + (self->mb_col << 3) + H;
	dest = (self->mb_row * width + self->mb_col) << 1;
	last = dest + (width << 1);

	int cr1, cr2, cr,
		cb1, cb2, cb;
	if (odd_h) {
		if (odd_v) {
			while (dest < last) {
				cr1 = s_cr[src] + s_cr[src+width];
				cb1 = s_cb[src] + s_cb[src+width];
				src++;
				for (x = 0; x < 2; x++) {
					cr2 = s_cr[src] + s_cr[src+width];
					cb2 = s_cb[src] + s_cb[src+width]; src++;
					cr = (((cr1 + cr2 + 2) >> 2) & 0xff);
					cb = (((cb1 + cb2 + 2) >> 2) & 0xff);

					cr1 = s_cr[src] + s_cr[src+width];
					cb1 = s_cb[src] + s_cb[src+width]; src++;
					cr |= (((cr1 + cr2 + 2) << 6) & 0xff00);
					cb |= (((cb1 + cb2 + 2) << 6) & 0xff00);

					cr2 = s_cr[src] + s_cr[src+width];
					cb2 = s_cb[src] + s_cb[src+width]; src++;
					cr |= (((cr1 + cr2 + 2) << 14) & 0xff0000);
					cb |= (((cb1 + cb2 + 2) << 14) & 0xff0000);

					cr1 = s_cr[src] + s_cr[src+width];
					cb1 = s_cb[src] + s_cb[src+width]; src++;
					cr |= (((cr1 + cr2 + 2) << 22) & 0xff000000);
					cb |= (((cb1 + cb2 + 2) << 22) & 0xff000000);

					d_cr[dest] = cr;
					d_cb[dest] = cb;
					dest++;
				}
				dest += scan >> 2; src += scan-1;
			}
		}
		else {
			while (dest < last) {
				cr1 = s_cr[src];
				cb1 = s_cb[src];
				src++;
				for (x = 0; x < 2; x++) {
					cr2 = s_cr[src];
					cb2 = s_cb[src++];
					cr = (((cr1 + cr2 + 1) >> 1) & 0xff);
					cb = (((cb1 + cb2 + 1) >> 1) & 0xff);

					cr1 = s_cr[src];
					cb1 = s_cb[src++];
					cr |= (((cr1 + cr2 + 1) << 7) & 0xff00);
					cb |= (((cb1 + cb2 + 1) << 7) & 0xff00);

					cr2 = s_cr[src];
					cb2 = s_cb[src++];
					cr |= (((cr1 + cr2 + 1) << 15) & 0xff0000);
					cb |= (((cb1 + cb2 + 1) << 15) & 0xff0000);

					cr1 = s_cr[src];
					cb1 = s_cb[src++];
					cr |= (((cr1 + cr2 + 1) << 23) & 0xff000000);
					cb |= (((cb1 + cb2 + 1) << 23) & 0xff000000);

					d_cr[dest] = cr;
					d_cb[dest] = cb;
					dest++;
				}
				dest += scan >> 2; src += scan-1;
			}
		}
	}
	else {
		if (odd_v) {
			while (dest < last) {
				for (x = 0; x < 2; x++) {
					cr = (((s_cr[src] + s_cr[src+width] + 1) >> 1) & 0xff);
					cb = (((s_cb[src] + s_cb[src+width] + 1) >> 1) & 0xff); src++;

					cr |= (((s_cr[src] + s_cr[src+width] + 1) << 7) & 0xff00);
					cb |= (((s_cb[src] + s_cb[src+width] + 1) << 7) & 0xff00); src++;

					cr |= (((s_cr[src] + s_cr[src+width] + 1) << 15) & 0xff0000);
					cb |= (((s_cb[src] + s_cb[src+width] + 1) << 15) & 0xff0000); src++;

					cr |= (((s_cr[src] + s_cr[src+width] + 1) << 23) & 0xff000000);
					cb |= (((s_cb[src] + s_cb[src+width] + 1) << 23) & 0xff000000); src++;

					d_cr[dest] = cr;
					d_cb[dest] = cb;
					dest++;
				}
				dest += scan >> 2; src += scan;
			}
		}
		else {
			while (dest < last) {
				for (x = 0; x < 2; x++) {
					cr = s_cr[src];
					cb = s_cb[src]; src++;

					cr |= s_cr[src] << 8;
					cb |= s_cb[src] << 8; src++;

					cr |= s_cr[src] << 16;
					cb |= s_cb[src] << 16; src++;

					cr |= s_cr[src] << 24;
					cb |= s_cb[src] << 24; src++;

					d_cr[dest] = cr;
					d_cb[dest] = cb;
					dest++;
				}
				dest += scan >> 2; src += scan;
			}
		}
	}
}


// Block layer

void decode_block(mpeg1_decoder_t *self, int block) {

	int n = 0;
	uint8_t *quant_matrix;

	// Decode DC coefficient of intra-coded blocks
	if (self->macroblock_intra) {
		int predictor;
		int dctSize;

		// DC prediction

		if (block < 4) {
			predictor = self->dc_predictor_y;
			dctSize = read_huffman(self->bits, DCT_DC_SIZE_LUMINANCE);
		}
		else {
			predictor = (block == 4 ? self->dc_predictor_cr : self->dc_predictor_cb);
			dctSize = read_huffman(self->bits, DCT_DC_SIZE_CHROMINANCE);
		}

		// Read DC coeff
		if (dctSize > 0) {
			int differential = bit_buffer_read(self->bits, dctSize);
			if ((differential & (1 << (dctSize - 1))) != 0) {
				self->block_data[0] = predictor + differential;
			}
			else {
				self->block_data[0] = predictor + ((-1 << dctSize)|(differential+1));
			}
		}
		else {
			self->block_data[0] = predictor;
		}

		// Save predictor value
		if (block < 4) {
			self->dc_predictor_y = self->block_data[0];
		}
		else if (block == 4) {
			self->dc_predictor_cr = self->block_data[0];
		}
		else {
			self->dc_predictor_cb = self->block_data[0];
		}

		// Dequantize + premultiply
		self->block_data[0] <<= (3 + 5);

		quant_matrix = self->intra_quant_matrix;
		n = 1;
	}
	else {
		quant_matrix = self->non_intra_quant_matrix;
	}

	// Decode AC coefficients (+DC for non-intra)
	int level = 0;
	while (true) {
		int run = 0;
		int coeff = read_huffman(self->bits, DCT_COEFF);

		if ((coeff == 0x0001) && (n > 0) && (bit_buffer_read(self->bits, 1) == 0)) {
			// end_of_block
			break;
		}
		if (coeff == 0xffff) {
			// escape
			run = bit_buffer_read(self->bits, 6);
			level = bit_buffer_read(self->bits, 8);
			if (level == 0) {
				level = bit_buffer_read(self->bits, 8);
			}
			else if (level == 128) {
				level = bit_buffer_read(self->bits, 8) - 256;
			}
			else if (level > 128) {
				level = level - 256;
			}
		}
		else {
			run = coeff >> 8;
			level = coeff & 0xff;
			if (bit_buffer_read(self->bits, 1)) {
				level = -level;
			}
		}

		n += run;
		int dezigZagged = ZIG_ZAG[n];
		n++;

		// Dequantize, oddify, clip
		level <<= 1;
		if (!self->macroblock_intra) {
			level += (level < 0 ? -1 : 1);
		}
		level = (level * self->quantizer_scale * quant_matrix[dezigZagged]) >> 4;
		if ((level & 1) == 0) {
			level -= level > 0 ? 1 : -1;
		}
		if (level > 2047) {
			level = 2047;
		}
		else if (level < -2048) {
			level = -2048;
		}

		// Save premultiplied coefficient
		self->block_data[dezigZagged] = level * PREMULTIPLIER_MATRIX[dezigZagged];
	}

	// Move block to its place
	uint8_t *dest_array;
	int dest_index;
	int scan;

	if (block < 4) {
		dest_array = self->planes_current.y;
		scan = self->coded_width - 8;
		dest_index = (self->mb_row * self->coded_width + self->mb_col) << 4;
		if ((block & 1) != 0) {
			dest_index += 8;
		}
		if ((block & 2) != 0) {
			dest_index += self->coded_width << 3;
		}
	}
	else {
		dest_array = (block == 4) ? self->planes_current.cb : self->planes_current.cr;
		scan = (self->coded_width >> 1) - 8;
		dest_index = ((self->mb_row * self->coded_width) << 2) + (self->mb_col << 3);
	}

	if (self->macroblock_intra) {
		// Overwrite (no prediction)
		if (n == 1) {
			copy_value_to_destination((self->block_data[0] + 128) >> 8, dest_array, dest_index, scan);
			self->block_data[0] = 0;
		}
		else {
			idct(self->block_data);
			copy_block_to_destination(self->block_data, dest_array, dest_index, scan);
			zero_block_data(self);
		}
	}
	else {
		// Add data to the predicted macroblock
		if (n == 1) {
			add_value_to_destination((self->block_data[0] + 128) >> 8, dest_array, dest_index, scan);
			self->block_data[0] = 0;
		}
		else {
			idct(self->block_data);
			add_block_to_destination(self->block_data, dest_array, dest_index, scan);
			zero_block_data(self);
		}
	}

	n = 0;
}


// -----------------------------------------------------------------------------
// Private functions

void zero_block_data(mpeg1_decoder_t *self) {
	for (int i = 0; i < 64; i++) {
		self->block_data[i] = 0;
	}
}

inline uint8_t clamp_to_uint8(int n) {
	return n > 255 
		? 255 
		: (n < 0 ? 0 : n);
}

void copy_block_to_destination(int *block, uint8_t *dest, int index, int scan) {
	for (int n = 0; n < 64; n += 8, index += scan+8) {
		dest[index+0] = clamp_to_uint8(block[n+0]);
		dest[index+1] = clamp_to_uint8(block[n+1]);
		dest[index+2] = clamp_to_uint8(block[n+2]);
		dest[index+3] = clamp_to_uint8(block[n+3]);
		dest[index+4] = clamp_to_uint8(block[n+4]);
		dest[index+5] = clamp_to_uint8(block[n+5]);
		dest[index+6] = clamp_to_uint8(block[n+6]);
		dest[index+7] = clamp_to_uint8(block[n+7]);
	}
}

void add_block_to_destination(int *block, uint8_t *dest, int index, int scan) {
	for (int n = 0; n < 64; n += 8, index += scan+8) {
		dest[index+0] = clamp_to_uint8(dest[index+0] + block[n+0]);
		dest[index+1] = clamp_to_uint8(dest[index+1] + block[n+1]);
		dest[index+2] = clamp_to_uint8(dest[index+2] + block[n+2]);
		dest[index+3] = clamp_to_uint8(dest[index+3] + block[n+3]);
		dest[index+4] = clamp_to_uint8(dest[index+4] + block[n+4]);
		dest[index+5] = clamp_to_uint8(dest[index+5] + block[n+5]);
		dest[index+6] = clamp_to_uint8(dest[index+6] + block[n+6]);
		dest[index+7] = clamp_to_uint8(dest[index+7] + block[n+7]);
	}
}

void copy_value_to_destination(int value, uint8_t *dest, int index, int scan) {
	value = clamp_to_uint8(value);
	for (int n = 0; n < 64; n += 8, index += scan+8) {
		dest[index+0] = value;
		dest[index+1] = value;
		dest[index+2] = value;
		dest[index+3] = value;
		dest[index+4] = value;
		dest[index+5] = value;
		dest[index+6] = value;
		dest[index+7] = value;
	}
}

void add_value_to_destination(int value, uint8_t *dest, int index, int scan) {
	for (int n = 0; n < 64; n += 8, index += scan+8) {
		dest[index+0] = clamp_to_uint8(dest[index+0] + value);
		dest[index+1] = clamp_to_uint8(dest[index+1] + value);
		dest[index+2] = clamp_to_uint8(dest[index+2] + value);
		dest[index+3] = clamp_to_uint8(dest[index+3] + value);
		dest[index+4] = clamp_to_uint8(dest[index+4] + value);
		dest[index+5] = clamp_to_uint8(dest[index+5] + value);
		dest[index+6] = clamp_to_uint8(dest[index+6] + value);
		dest[index+7] = clamp_to_uint8(dest[index+7] + value);
	}
}

void idct(int *block) {
	// See http://vsr.informatik.tu-chemnitz.de/~jan/MPEG/HTML/IDCT.html
	// for more info.

	int
		b1, b3, b4, b6, b7, tmp1, tmp2, m0,
		x0, x1, x2, x3, x4, y3, y4, y5, y6, y7;

	// Transform columns
	for (int i = 0; i < 8; ++i) {
		b1 = block[4*8+i];
		b3 = block[2*8+i] + block[6*8+i];
		b4 = block[5*8+i] - block[3*8+i];
		tmp1 = block[1*8+i] + block[7*8+i];
		tmp2 = block[3*8+i] + block[5*8+i];
		b6 = block[1*8+i] - block[7*8+i];
		b7 = tmp1 + tmp2;
		m0 = block[0*8+i];
		x4 = ((b6*473 - b4*196 + 128) >> 8) - b7;
		x0 = x4 - (((tmp1 - tmp2)*362 + 128) >> 8);
		x1 = m0 - b1;
		x2 = (((block[2*8+i] - block[6*8+i])*362 + 128) >> 8) - b3;
		x3 = m0 + b1;
		y3 = x1 + x2;
		y4 = x3 + b3;
		y5 = x1 - x2;
		y6 = x3 - b3;
		y7 = -x0 - ((b4*473 + b6*196 + 128) >> 8);
		block[0*8+i] = b7 + y4;
		block[1*8+i] = x4 + y3;
		block[2*8+i] = y5 - x0;
		block[3*8+i] = y6 - y7;
		block[4*8+i] = y6 + y7;
		block[5*8+i] = x0 + y5;
		block[6*8+i] = y3 - x4;
		block[7*8+i] = y4 - b7;
	}

	// Transform rows
	for (int i = 0; i < 64; i += 8) {
		b1 = block[4+i];
		b3 = block[2+i] + block[6+i];
		b4 = block[5+i] - block[3+i];
		tmp1 = block[1+i] + block[7+i];
		tmp2 = block[3+i] + block[5+i];
		b6 = block[1+i] - block[7+i];
		b7 = tmp1 + tmp2;
		m0 = block[0+i];
		x4 = ((b6*473 - b4*196 + 128) >> 8) - b7;
		x0 = x4 - (((tmp1 - tmp2)*362 + 128) >> 8);
		x1 = m0 - b1;
		x2 = (((block[2+i] - block[6+i])*362 + 128) >> 8) - b3;
		x3 = m0 + b1;
		y3 = x1 + x2;
		y4 = x3 + b3;
		y5 = x1 - x2;
		y6 = x3 - b3;
		y7 = -x0 - ((b4*473 + b6*196 + 128) >> 8);
		block[0+i] = (b7 + y4 + 128) >> 8;
		block[1+i] = (x4 + y3 + 128) >> 8;
		block[2+i] = (y5 - x0 + 128) >> 8;
		block[3+i] = (y6 - y7 + 128) >> 8;
		block[4+i] = (y6 + y7 + 128) >> 8;
		block[5+i] = (x0 + y5 + 128) >> 8;
		block[6+i] = (y3 - x4 + 128) >> 8;
		block[7+i] = (y4 - b7 + 128) >> 8;
	}
}

int read_huffman(bit_buffer_t *bits, const int *code_table) {
	int state = 0;
	do {
		state = code_table[state + bit_buffer_read(bits, 1)];
	} while (state >= 0 && code_table[state] != 0);
	return code_table[state+2];
}
