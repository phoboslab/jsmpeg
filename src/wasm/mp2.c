#include <string.h>
#include <stdlib.h>
#include "mp2.h"

const static int FRAME_SYNC = 0x7ff;

const static int VERSION_MPEG_2_5 = 0x0;
const static int VERSION_MPEG_2 = 0x2;
const static int VERSION_MPEG_1 = 0x3;

const static int LAYER_III = 0x1;
const static int LAYER_II = 0x2;
const static int LAYER_I = 0x3;

const static int MODE_STEREO = 0x0;
const static int MODE_JOINT_STEREO = 0x1;
const static int MODE_DUAL_CHANNEL = 0x2;
const static int MODE_MONO = 0x3;

const static unsigned short SAMPLE_RATE[] = {
	44100, 48000, 32000, 0, // MPEG-1
	22050, 24000, 16000, 0  // MPEG-2
};

const static short BIT_RATE[] = {
	32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, // MPEG-1
	 8, 16, 24, 32, 40, 48,  56,  64,  80,  96, 112, 128, 144, 160  // MPEG-2
};

const static int SCALEFACTOR_BASE[] = {
	0x02000000, 0x01965FEA, 0x01428A30
};

const static float SYNTHESIS_WINDOW[] = {
	     0.0,     -0.5,     -0.5,     -0.5,     -0.5,     -0.5,
	    -0.5,     -1.0,     -1.0,     -1.0,     -1.0,     -1.5,
	    -1.5,     -2.0,     -2.0,     -2.5,     -2.5,     -3.0,
	    -3.5,     -3.5,     -4.0,     -4.5,     -5.0,     -5.5,
	    -6.5,     -7.0,     -8.0,     -8.5,     -9.5,    -10.5,
	   -12.0,    -13.0,    -14.5,    -15.5,    -17.5,    -19.0,
	   -20.5,    -22.5,    -24.5,    -26.5,    -29.0,    -31.5,
	   -34.0,    -36.5,    -39.5,    -42.5,    -45.5,    -48.5,
	   -52.0,    -55.5,    -58.5,    -62.5,    -66.0,    -69.5,
	   -73.5,    -77.0,    -80.5,    -84.5,    -88.0,    -91.5,
	   -95.0,    -98.0,   -101.0,   -104.0,    106.5,    109.0,
	   111.0,    112.5,    113.5,    114.0,    114.0,    113.5,
	   112.0,    110.5,    107.5,    104.0,    100.0,     94.5,
	    88.5,     81.5,     73.0,     63.5,     53.0,     41.5,
	    28.5,     14.5,     -1.0,    -18.0,    -36.0,    -55.5,
	   -76.5,    -98.5,   -122.0,   -147.0,   -173.5,   -200.5,
	  -229.5,   -259.5,   -290.5,   -322.5,   -355.5,   -389.5,
	  -424.0,   -459.5,   -495.5,   -532.0,   -568.5,   -605.0,
	  -641.5,   -678.0,   -714.0,   -749.0,   -783.5,   -817.0,
	  -849.0,   -879.5,   -908.5,   -935.0,   -959.5,   -981.0,
	 -1000.5,  -1016.0,  -1028.5,  -1037.5,  -1042.5,  -1043.5,
	 -1040.0,  -1031.5,   1018.5,   1000.0,    976.0,    946.5,
	   911.0,    869.5,    822.0,    767.5,    707.0,    640.0,
	   565.5,    485.0,    397.0,    302.5,    201.0,     92.5,
	   -22.5,   -144.0,   -272.5,   -407.0,   -547.5,   -694.0,
	  -846.0,  -1003.0,  -1165.0,  -1331.5,  -1502.0,  -1675.5,
	 -1852.5,  -2031.5,  -2212.5,  -2394.0,  -2576.5,  -2758.5,
	 -2939.5,  -3118.5,  -3294.5,  -3467.5,  -3635.5,  -3798.5,
	 -3955.0,  -4104.5,  -4245.5,  -4377.5,  -4499.0,  -4609.5,
	 -4708.0,  -4792.5,  -4863.5,  -4919.0,  -4958.0,  -4979.5,
	 -4983.0,  -4967.5,  -4931.5,  -4875.0,  -4796.0,  -4694.5,
	 -4569.5,  -4420.0,  -4246.0,  -4046.0,  -3820.0,  -3567.0,
	  3287.0,   2979.5,   2644.0,   2280.5,   1888.0,   1467.5,
	  1018.5,    541.0,     35.0,   -499.0,  -1061.0,  -1650.0,
	 -2266.5,  -2909.0,  -3577.0,  -4270.0,  -4987.5,  -5727.5,
	 -6490.0,  -7274.0,  -8077.5,  -8899.5,  -9739.0, -10594.5,
	-11464.5, -12347.0, -13241.0, -14144.5, -15056.0, -15973.5,
	-16895.5, -17820.0, -18744.5, -19668.0, -20588.0, -21503.0,
	-22410.5, -23308.5, -24195.0, -25068.5, -25926.5, -26767.0,
	-27589.0, -28389.0, -29166.5, -29919.0, -30644.5, -31342.0,
	-32009.5, -32645.0, -33247.0, -33814.5, -34346.0, -34839.5,
	-35295.0, -35710.0, -36084.5, -36417.5, -36707.5, -36954.0,
	-37156.5, -37315.0, -37428.0, -37496.0,  37519.0,  37496.0,
	 37428.0,  37315.0,  37156.5,  36954.0,  36707.5,  36417.5,
	 36084.5,  35710.0,  35295.0,  34839.5,  34346.0,  33814.5,
	 33247.0,  32645.0,  32009.5,  31342.0,  30644.5,  29919.0,
	 29166.5,  28389.0,  27589.0,  26767.0,  25926.5,  25068.5,
	 24195.0,  23308.5,  22410.5,  21503.0,  20588.0,  19668.0,
	 18744.5,  17820.0,  16895.5,  15973.5,  15056.0,  14144.5,
	 13241.0,  12347.0,  11464.5,  10594.5,   9739.0,   8899.5,
	  8077.5,   7274.0,   6490.0,   5727.5,   4987.5,   4270.0,
	  3577.0,   2909.0,   2266.5,   1650.0,   1061.0,    499.0,
	   -35.0,   -541.0,  -1018.5,  -1467.5,  -1888.0,  -2280.5,
	 -2644.0,  -2979.5,   3287.0,   3567.0,   3820.0,   4046.0,
	  4246.0,   4420.0,   4569.5,   4694.5,   4796.0,   4875.0,
	  4931.5,   4967.5,   4983.0,   4979.5,   4958.0,   4919.0,
	  4863.5,   4792.5,   4708.0,   4609.5,   4499.0,   4377.5,
	  4245.5,   4104.5,   3955.0,   3798.5,   3635.5,   3467.5,
	  3294.5,   3118.5,   2939.5,   2758.5,   2576.5,   2394.0,
	  2212.5,   2031.5,   1852.5,   1675.5,   1502.0,   1331.5,
	  1165.0,   1003.0,    846.0,    694.0,    547.5,    407.0,
	   272.5,    144.0,     22.5,    -92.5,   -201.0,   -302.5,
	  -397.0,   -485.0,   -565.5,   -640.0,   -707.0,   -767.5,
	  -822.0,   -869.5,   -911.0,   -946.5,   -976.0,  -1000.0,
	  1018.5,   1031.5,   1040.0,   1043.5,   1042.5,   1037.5,
	  1028.5,   1016.0,   1000.5,    981.0,    959.5,    935.0,
	   908.5,    879.5,    849.0,    817.0,    783.5,    749.0,
	   714.0,    678.0,    641.5,    605.0,    568.5,    532.0,
	   495.5,    459.5,    424.0,    389.5,    355.5,    322.5,
	   290.5,    259.5,    229.5,    200.5,    173.5,    147.0,
	   122.0,     98.5,     76.5,     55.5,     36.0,     18.0,
		1.0,    -14.5,    -28.5,    -41.5,    -53.0,    -63.5,
	   -73.0,    -81.5,    -88.5,    -94.5,   -100.0,   -104.0,
	  -107.5,   -110.5,   -112.0,   -113.5,   -114.0,   -114.0,
	  -113.5,   -112.5,   -111.0,   -109.0,    106.5,    104.0,
	   101.0,     98.0,     95.0,     91.5,     88.0,     84.5,
	    80.5,     77.0,     73.5,     69.5,     66.0,     62.5,
	    58.5,     55.5,     52.0,     48.5,     45.5,     42.5,
	    39.5,     36.5,     34.0,     31.5,     29.0,     26.5,
	    24.5,     22.5,     20.5,     19.0,     17.5,     15.5,
	    14.5,     13.0,     12.0,     10.5,      9.5,      8.5,
	     8.0,      7.0,      6.5,      5.5,      5.0,      4.5,
	     4.0,      3.5,      3.5,      3.0,      2.5,      2.5,
	     2.0,      2.0,      1.5,      1.5,      1.0,      1.0,
	     1.0,      1.0,      0.5,      0.5,      0.5,      0.5,
	     0.5,      0.5
};

// Quantizer lookup, step 1: bitrate classes
const static uint8_t QUANT_LUT_STEP_1[2][16] = {
 	// 32, 48, 56, 64, 80, 96,112,128,160,192,224,256,320,384 <- bitrate
	{   0,  0,  1,  1,  1,  2,  2,  2,  2,  2,  2,  2,  2,  2}, // mono
	// 16, 24, 28, 32, 40, 48, 56, 64, 80, 96,112,128,160,192 <- bitrate / chan
	{   0,  0,  0,  0,  0,  0,  1,  1,  1,  2,  2,  2,  2,  2} // stereo
};

// Quantizer lookup, step 2: bitrate class, sample rate -> B2 table idx, sblimit
const static uint8_t QUANT_TAB_A = (27 | 64);   // Table 3-B.2a: high-rate, sblimit = 27
const static uint8_t QUANT_TAB_B = (30 | 64);   // Table 3-B.2b: high-rate, sblimit = 30
const static uint8_t QUANT_TAB_C =   8;         // Table 3-B.2c:  low-rate, sblimit =  8
const static uint8_t QUANT_TAB_D =  12;         // Table 3-B.2d:  low-rate, sblimit = 12

const static uint8_t QUANT_LUT_STEP_2[3][3] = {
	// 44.1 kHz,    48 kHz,      32 kHz
	{QUANT_TAB_C, QUANT_TAB_C, QUANT_TAB_D}, // 32 - 48 kbit/sec/ch
	{QUANT_TAB_A, QUANT_TAB_A, QUANT_TAB_A}, // 56 - 80 kbit/sec/ch
	{QUANT_TAB_B, QUANT_TAB_A, QUANT_TAB_B}  // 96+	 kbit/sec/ch
};

// Quantizer lookup, step 3: B2 table, subband -> nbal, row index
// (upper 4 bits: nbal, lower 4 bits: row index)
const static uint8_t QUANT_LUT_STEP_3[3][32] = {
	// Low-rate table (3-B.2c and 3-B.2d)
	{
		0x44,0x44,
	  	0x34,0x34,0x34,0x34,0x34,0x34,0x34,0x34,0x34,0x34
	},
	// High-rate table (3-B.2a and 3-B.2b)
	{
		0x43,0x43,0x43,
		0x42,0x42,0x42,0x42,0x42,0x42,0x42,0x42,
		0x31,0x31,0x31,0x31,0x31,0x31,0x31,0x31,0x31,0x31,0x31,0x31,
		0x20,0x20,0x20,0x20,0x20,0x20,0x20
	},
	// MPEG-2 LSR table (B.2 in ISO 13818-3)
	{
		0x45,0x45,0x45,0x45,
		0x34,0x34,0x34,0x34,0x34,0x34,0x34,
		0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,
					   0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24	
	}
};

// Quantizer lookup, step 4: table row, allocation[] value -> quant table index
const static uint8_t QUANT_LUT_STEP4[6][16] = {
	{0, 1, 2, 17},
	{0, 1, 2, 3, 4, 5, 6, 17},
	{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17},
	{0, 1, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17},
	{0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17},
	{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}
};

typedef struct quantizer_spec_t {
	unsigned short levels;
	unsigned char group;
	unsigned char bits;
} quantizer_spec_t;

const static quantizer_spec_t QUANT_TAB[] = {
	{.levels =     3, .group = 1, .bits =  5},  //  1
	{.levels =     5, .group = 1, .bits =  7},  //  2
	{.levels =     7, .group = 0, .bits =  3},  //  3
	{.levels =     9, .group = 1, .bits = 10},  //  4
	{.levels =    15, .group = 0, .bits =  4},  //  5
	{.levels =    31, .group = 0, .bits =  5},  //  6
	{.levels =    63, .group = 0, .bits =  6},  //  7
	{.levels =   127, .group = 0, .bits =  7},  //  8
	{.levels =   255, .group = 0, .bits =  8},  //  9
	{.levels =   511, .group = 0, .bits =  9},  // 10
	{.levels =  1023, .group = 0, .bits = 10},  // 11
	{.levels =  2047, .group = 0, .bits = 11},  // 12
	{.levels =  4095, .group = 0, .bits = 12},  // 13
	{.levels =  8191, .group = 0, .bits = 13},  // 14
	{.levels = 16383, .group = 0, .bits = 14},  // 15
	{.levels = 32767, .group = 0, .bits = 15},  // 16
	{.levels = 65535, .group = 0, .bits = 16}   // 17
};

#define SAMPLES_PER_FRAME 1152

typedef struct mp2_decoder_t {
	int sample_rate;
	int v_pos;

	bit_buffer_t *bits;

	const quantizer_spec_t *allocation[2][32];
	uint8_t scale_factor_info[2][32];
	int scale_factor[2][32][3];
	int sample[2][32][3];

	float channel_left[SAMPLES_PER_FRAME];
	float channel_right[SAMPLES_PER_FRAME];
	float D[1024];
	float V[2][1024];
	int U[32];
} mp2_decoder_t;


void matrix_transform(int s[32][3], int ss, float *d, int dp);
void read_samples(mp2_decoder_t *self, int ch, int sb, int part);
const quantizer_spec_t *read_allocation(mp2_decoder_t *self, int sb, int tab3);
int decode_frame(mp2_decoder_t *self);


// -----------------------------------------------------------------------------
// Public interface

mp2_decoder_t *mp2_decoder_create(unsigned int buffer_size, bit_buffer_mode_t buffer_mode) {
	mp2_decoder_t *self = malloc(sizeof(mp2_decoder_t));
	memset(self, 0, sizeof(mp2_decoder_t));
	self->bits = bit_buffer_create(buffer_size, buffer_mode);

	self->sample_rate = 44100;
	memcpy(self->D, SYNTHESIS_WINDOW, 512 * sizeof(float));
	memcpy(self->D + 512, SYNTHESIS_WINDOW, 512 * sizeof(float));

	return self;
}

void mp2_decoder_destroy(mp2_decoder_t *self) {
	bit_buffer_destroy(self->bits);
	free(self);
}

void *mp2_decoder_get_write_ptr(mp2_decoder_t *self, unsigned int byte_size) {
	return bit_buffer_get_write_ptr(self->bits, byte_size);
}

int mp2_decoder_get_index(mp2_decoder_t *self) {
	return bit_buffer_get_index(self->bits);
}

void mp2_decoder_set_index(mp2_decoder_t *self, unsigned int index) {
	bit_buffer_set_index(self->bits, index);
}

void mp2_decoder_did_write(mp2_decoder_t *self, unsigned int byte_size) {
	bit_buffer_did_write(self->bits, byte_size);
}

int mp2_decoder_get_sample_rate(mp2_decoder_t *self) {
	return self->sample_rate;
}

void *mp2_decoder_get_left_channel_ptr(mp2_decoder_t *self) {
	return self->channel_left;
}

void *mp2_decoder_get_right_channel_ptr(mp2_decoder_t *self) {
	return self->channel_right;
}

int mp2_decoder_decode(mp2_decoder_t *self) {
	int byte_pos = bit_buffer_get_index(self->bits) >> 3;

	if (!bit_buffer_has(self->bits, 16)) {
		return 0;
	}

	int decoded_bytes = decode_frame(self);
	bit_buffer_set_index(self->bits, (byte_pos + decoded_bytes) << 3);
	return decoded_bytes;
}




int decode_frame(mp2_decoder_t *self) {
	// Check for valid header: syncword OK, MPEG-Audio Layer 2
	int sync = bit_buffer_read(self->bits, 11);
	int version = bit_buffer_read(self->bits, 2);
	int layer = bit_buffer_read(self->bits, 2);
	int hasCRC = !bit_buffer_read(self->bits, 1);

	if (
		sync != FRAME_SYNC ||
		version != VERSION_MPEG_1 ||
		layer != LAYER_II
	) {
		return 0; // Invalid header or unsupported version
	}

	int bitrate_index = bit_buffer_read(self->bits, 4) - 1;
	if (bitrate_index > 13) {
		return 0;  // Invalid bit rate or 'free format'
	}

	int sample_rate_index = bit_buffer_read(self->bits, 2);
	int sample_rate = SAMPLE_RATE[sample_rate_index];
	if (sample_rate_index == 3) {
		return 0; // Invalid sample rate
	}
	if (version == VERSION_MPEG_2) {
		sample_rate_index += 4;
		bitrate_index += 14;
	}
	int padding = bit_buffer_read(self->bits, 1),
		privat = bit_buffer_read(self->bits, 1),
		mode = bit_buffer_read(self->bits, 2);

	// Parse the mode_extension, set up the stereo bound
	int bound = 0;
	if (mode == MODE_JOINT_STEREO) {
		bound = (bit_buffer_read(self->bits, 2) + 1) << 2;
	}
	else {
		bit_buffer_skip(self->bits, 2);
		bound = (mode == MODE_MONO) ? 0 : 32;
	}

	// Discard the last 4 bits of the header and the CRC value, if present
	bit_buffer_skip(self->bits, 4);
	if (hasCRC) {
		bit_buffer_skip(self->bits, 16);
	}

	// Compute the frame size
	int bitrate = BIT_RATE[bitrate_index];
	sample_rate = SAMPLE_RATE[sample_rate_index];
	int frame_size = ((144000 * bitrate / sample_rate) + padding)|0;
	

	// Prepare the quantizer table lookups
	int tab3 = 0;
	int sblimit = 0;
	if (version == VERSION_MPEG_2) {
		// MPEG-2 (LSR)
		tab3 = 2;
		sblimit = 30;
	}
	else {
		// MPEG-1
		int tab1 = (mode == MODE_MONO) ? 0 : 1;
		int tab2 = QUANT_LUT_STEP_1[tab1][bitrate_index];
		tab3 = QUANT_LUT_STEP_2[tab2][sample_rate_index];
		sblimit = tab3 & 63;
		tab3 >>= 6;
	}

	if (bound > sblimit) {
		bound = sblimit;
	}

	// Read the allocation information
	for (int sb = 0; sb < bound; sb++) {
		self->allocation[0][sb] = read_allocation(self, sb, tab3);
		self->allocation[1][sb] = read_allocation(self, sb, tab3);
	}

	for (int sb = bound; sb < sblimit; sb++) {
		self->allocation[0][sb] = 
			self->allocation[1][sb] =
			read_allocation(self, sb, tab3);
	}

	// Read scale factor selector information
	int channels = (mode == MODE_MONO) ? 1 : 2;
	for (int sb = 0;  sb < sblimit; sb++) {
		for (int ch = 0;  ch < channels; ch++) {
			if (self->allocation[ch][sb]) {
				self->scale_factor_info[ch][sb] = bit_buffer_read(self->bits, 2);
			}
		}
		if (mode == MODE_MONO) {
			self->scale_factor_info[1][sb] = self->scale_factor_info[0][sb];
		}
	}

	// Read scale factors
	for (int sb = 0;  sb < sblimit; sb++) {
		for (int ch = 0;  ch < channels; ch++) {
			if (self->allocation[ch][sb]) {
				int *sf = self->scale_factor[ch][sb];
				switch (self->scale_factor_info[ch][sb]) {
					case 0:
						sf[0] = bit_buffer_read(self->bits, 6);
						sf[1] = bit_buffer_read(self->bits, 6);
						sf[2] = bit_buffer_read(self->bits, 6);
						break;
					case 1:
						sf[0] =
						sf[1] = bit_buffer_read(self->bits, 6);
						sf[2] = bit_buffer_read(self->bits, 6);
						break;
					case 2:
						sf[0] =
						sf[1] =
						sf[2] = bit_buffer_read(self->bits, 6);
						break;
					case 3:
						sf[0] = bit_buffer_read(self->bits, 6);
						sf[1] =
						sf[2] = bit_buffer_read(self->bits, 6);
						break;
				}
			}
		}
		if (mode == MODE_MONO) {
			self->scale_factor[1][sb][0] = self->scale_factor[0][sb][0];
			self->scale_factor[1][sb][1] = self->scale_factor[0][sb][1];
			self->scale_factor[1][sb][2] = self->scale_factor[0][sb][2];
		}
	}

	// Coefficient input and reconstruction
	int out_pos = 0;
	for (int part = 0; part < 3; part++) {
		for (int granule = 0; granule < 4; granule++) {

			// Read the samples
			for (int sb = 0; sb < bound; sb++) {
				read_samples(self, 0, sb, part);
				read_samples(self, 1, sb, part);
			}
			for (int sb = bound; sb < sblimit; sb++) {
				read_samples(self, 0, sb, part);
				self->sample[1][sb][0] = self->sample[0][sb][0];
				self->sample[1][sb][1] = self->sample[0][sb][1];
				self->sample[1][sb][2] = self->sample[0][sb][2];
			}
			for (int sb = sblimit; sb < 32; sb++) {
				self->sample[0][sb][0] = 0;
				self->sample[0][sb][1] = 0;
				self->sample[0][sb][2] = 0;
				self->sample[1][sb][0] = 0;
				self->sample[1][sb][1] = 0;
				self->sample[1][sb][2] = 0;
			}

			// Synthesis loop
			for (int p = 0; p < 3; p++) {
				// Shifting step
				self->v_pos = (self->v_pos - 64) & 1023;

				for (int ch = 0;  ch < 2; ch++) {
					matrix_transform(self->sample[ch], p, self->V[ch], self->v_pos);

					// Build U, windowing, calculate output
					memset(self->U, 0, sizeof(self->U));

					int d_index = 512 - (self->v_pos >> 1);
					int v_index = (self->v_pos % 128) >> 1;
					while (v_index < 1024) {
						for (int i = 0; i < 32; ++i) {
							self->U[i] += self->D[d_index++] * self->V[ch][v_index++];
						}

						v_index += 128-32;
						d_index += 64-32;
					}

					v_index = (128-32 + 1024) - v_index;
					d_index -= (512 - 32);
					while (v_index < 1024) {
						for (int i = 0; i < 32; ++i) {
							self->U[i] += self->D[d_index++] * self->V[ch][v_index++];
						}

						v_index += 128-32;
						d_index += 64-32;
					}

					// Output samples
					float *out_channel = ch == 0 
						? self->channel_left 
						: self->channel_right;
					for (int j = 0; j < 32; j++) {
						out_channel[out_pos + j] = (float)self->U[j] / 2147418112.0;
					}
				} // End of synthesis channel loop
				out_pos += 32;
			} // End of synthesis sub-block loop

		} // Decoding of the granule finished
	}

	self->sample_rate = sample_rate;
	return frame_size;
}

const quantizer_spec_t *read_allocation(mp2_decoder_t *self, int sb, int tab3) {
	int tab4 = QUANT_LUT_STEP_3[tab3][sb];
	int qtab = QUANT_LUT_STEP4[tab4 & 15][bit_buffer_read(self->bits, tab4 >> 4)];
	return qtab ? (&QUANT_TAB[qtab - 1]) : 0;
}

void read_samples(mp2_decoder_t *self, int ch, int sb, int part) {
	const quantizer_spec_t *q = self->allocation[ch][sb];
	int sf = self->scale_factor[ch][sb][part];
	int *sample = self->sample[ch][sb];
	int val = 0;

	if (!q) {
		// No bits allocated for this subband
		sample[0] = sample[1] = sample[2] = 0;
		return;
	}

	// Resolve scalefactor
	if (sf == 63) {
		sf = 0;
	}
	else {
		int shift = (sf / 3)|0;
		sf = (SCALEFACTOR_BASE[sf % 3] + ((1 << shift) >> 1)) >> shift;
	}

	// Decode samples
	int adj = q->levels;
	if (q->group) {
		// Decode grouped samples
		val = bit_buffer_read(self->bits, q->bits);
		sample[0] = val % adj;
		val /= adj;
		sample[1] = val % adj;
		sample[2] = val / adj;
	}
	else {
		// Decode direct samples
		sample[0] = bit_buffer_read(self->bits, q->bits);
		sample[1] = bit_buffer_read(self->bits, q->bits);
		sample[2] = bit_buffer_read(self->bits, q->bits);
	}

	// Postmultiply samples
	int scale = 65536 / (adj + 1);
	adj = ((adj + 1) >> 1) - 1;

	val = (adj - sample[0]) * scale;
	sample[0] = (val * (sf >> 12) + ((val * (sf & 4095) + 2048) >> 12)) >> 12;

	val = (adj - sample[1]) * scale;
	sample[1] = (val * (sf >> 12) + ((val * (sf & 4095) + 2048) >> 12)) >> 12;

	val = (adj - sample[2]) * scale;
	sample[2] = (val * (sf >> 12) + ((val * (sf & 4095) + 2048) >> 12)) >> 12;
}

void matrix_transform(int s[32][3], int ss, float *d, int dp) {
	float t01, t02, t03, t04, t05, t06, t07, t08, t09, t10, t11, t12,
		t13, t14, t15, t16, t17, t18, t19, t20, t21, t22, t23, t24,
		t25, t26, t27, t28, t29, t30, t31, t32, t33;

	t01 = s[ 0][ss] + s[31][ss]; t02 = (float)(s[ 0][ss] - s[31][ss]) * 0.500602998235;
	t03 = s[ 1][ss] + s[30][ss]; t04 = (float)(s[ 1][ss] - s[30][ss]) * 0.505470959898;
	t05 = s[ 2][ss] + s[29][ss]; t06 = (float)(s[ 2][ss] - s[29][ss]) * 0.515447309923;
	t07 = s[ 3][ss] + s[28][ss]; t08 = (float)(s[ 3][ss] - s[28][ss]) * 0.53104259109;
	t09 = s[ 4][ss] + s[27][ss]; t10 = (float)(s[ 4][ss] - s[27][ss]) * 0.553103896034;
	t11 = s[ 5][ss] + s[26][ss]; t12 = (float)(s[ 5][ss] - s[26][ss]) * 0.582934968206;
	t13 = s[ 6][ss] + s[25][ss]; t14 = (float)(s[ 6][ss] - s[25][ss]) * 0.622504123036;
	t15 = s[ 7][ss] + s[24][ss]; t16 = (float)(s[ 7][ss] - s[24][ss]) * 0.674808341455;
	t17 = s[ 8][ss] + s[23][ss]; t18 = (float)(s[ 8][ss] - s[23][ss]) * 0.744536271002;
	t19 = s[ 9][ss] + s[22][ss]; t20 = (float)(s[ 9][ss] - s[22][ss]) * 0.839349645416;
	t21 = s[10][ss] + s[21][ss]; t22 = (float)(s[10][ss] - s[21][ss]) * 0.972568237862;
	t23 = s[11][ss] + s[20][ss]; t24 = (float)(s[11][ss] - s[20][ss]) * 1.16943993343;
	t25 = s[12][ss] + s[19][ss]; t26 = (float)(s[12][ss] - s[19][ss]) * 1.48416461631;
	t27 = s[13][ss] + s[18][ss]; t28 = (float)(s[13][ss] - s[18][ss]) * 2.05778100995;
	t29 = s[14][ss] + s[17][ss]; t30 = (float)(s[14][ss] - s[17][ss]) * 3.40760841847;
	t31 = s[15][ss] + s[16][ss]; t32 = (float)(s[15][ss] - s[16][ss]) * 10.1900081235;

	t33 = t01 + t31; t31 = (t01 - t31) * 0.502419286188;
	t01 = t03 + t29; t29 = (t03 - t29) * 0.52249861494;
	t03 = t05 + t27; t27 = (t05 - t27) * 0.566944034816;
	t05 = t07 + t25; t25 = (t07 - t25) * 0.64682178336;
	t07 = t09 + t23; t23 = (t09 - t23) * 0.788154623451;
	t09 = t11 + t21; t21 = (t11 - t21) * 1.06067768599;
	t11 = t13 + t19; t19 = (t13 - t19) * 1.72244709824;
	t13 = t15 + t17; t17 = (t15 - t17) * 5.10114861869;
	t15 = t33 + t13; t13 = (t33 - t13) * 0.509795579104;
	t33 = t01 + t11; t01 = (t01 - t11) * 0.601344886935;
	t11 = t03 + t09; t09 = (t03 - t09) * 0.899976223136;
	t03 = t05 + t07; t07 = (t05 - t07) * 2.56291544774;
	t05 = t15 + t03; t15 = (t15 - t03) * 0.541196100146;
	t03 = t33 + t11; t11 = (t33 - t11) * 1.30656296488;
	t33 = t05 + t03; t05 = (t05 - t03) * 0.707106781187;
	t03 = t15 + t11; t15 = (t15 - t11) * 0.707106781187;
	t03 += t15;
	t11 = t13 + t07; t13 = (t13 - t07) * 0.541196100146;
	t07 = t01 + t09; t09 = (t01 - t09) * 1.30656296488;
	t01 = t11 + t07; t07 = (t11 - t07) * 0.707106781187;
	t11 = t13 + t09; t13 = (t13 - t09) * 0.707106781187;
	t11 += t13; t01 += t11; 
	t11 += t07; t07 += t13;
	t09 = t31 + t17; t31 = (t31 - t17) * 0.509795579104;
	t17 = t29 + t19; t29 = (t29 - t19) * 0.601344886935;
	t19 = t27 + t21; t21 = (t27 - t21) * 0.899976223136;
	t27 = t25 + t23; t23 = (t25 - t23) * 2.56291544774;
	t25 = t09 + t27; t09 = (t09 - t27) * 0.541196100146;
	t27 = t17 + t19; t19 = (t17 - t19) * 1.30656296488;
	t17 = t25 + t27; t27 = (t25 - t27) * 0.707106781187;
	t25 = t09 + t19; t19 = (t09 - t19) * 0.707106781187;
	t25 += t19;
	t09 = t31 + t23; t31 = (t31 - t23) * 0.541196100146;
	t23 = t29 + t21; t21 = (t29 - t21) * 1.30656296488;
	t29 = t09 + t23; t23 = (t09 - t23) * 0.707106781187;
	t09 = t31 + t21; t31 = (t31 - t21) * 0.707106781187;
	t09 += t31;	t29 += t09;	t09 += t23;	t23 += t31;
	t17 += t29;	t29 += t25;	t25 += t09;	t09 += t27;
	t27 += t23;	t23 += t19; t19 += t31;	
	t21 = t02 + t32; t02 = (t02 - t32) * 0.502419286188;
	t32 = t04 + t30; t04 = (t04 - t30) * 0.52249861494;
	t30 = t06 + t28; t28 = (t06 - t28) * 0.566944034816;
	t06 = t08 + t26; t08 = (t08 - t26) * 0.64682178336;
	t26 = t10 + t24; t10 = (t10 - t24) * 0.788154623451;
	t24 = t12 + t22; t22 = (t12 - t22) * 1.06067768599;
	t12 = t14 + t20; t20 = (t14 - t20) * 1.72244709824;
	t14 = t16 + t18; t16 = (t16 - t18) * 5.10114861869;
	t18 = t21 + t14; t14 = (t21 - t14) * 0.509795579104;
	t21 = t32 + t12; t32 = (t32 - t12) * 0.601344886935;
	t12 = t30 + t24; t24 = (t30 - t24) * 0.899976223136;
	t30 = t06 + t26; t26 = (t06 - t26) * 2.56291544774;
	t06 = t18 + t30; t18 = (t18 - t30) * 0.541196100146;
	t30 = t21 + t12; t12 = (t21 - t12) * 1.30656296488;
	t21 = t06 + t30; t30 = (t06 - t30) * 0.707106781187;
	t06 = t18 + t12; t12 = (t18 - t12) * 0.707106781187;
	t06 += t12;
	t18 = t14 + t26; t26 = (t14 - t26) * 0.541196100146;
	t14 = t32 + t24; t24 = (t32 - t24) * 1.30656296488;
	t32 = t18 + t14; t14 = (t18 - t14) * 0.707106781187;
	t18 = t26 + t24; t24 = (t26 - t24) * 0.707106781187;
	t18 += t24; t32 += t18; 
	t18 += t14; t26 = t14 + t24;
	t14 = t02 + t16; t02 = (t02 - t16) * 0.509795579104;
	t16 = t04 + t20; t04 = (t04 - t20) * 0.601344886935;
	t20 = t28 + t22; t22 = (t28 - t22) * 0.899976223136;
	t28 = t08 + t10; t10 = (t08 - t10) * 2.56291544774;
	t08 = t14 + t28; t14 = (t14 - t28) * 0.541196100146;
	t28 = t16 + t20; t20 = (t16 - t20) * 1.30656296488;
	t16 = t08 + t28; t28 = (t08 - t28) * 0.707106781187;
	t08 = t14 + t20; t20 = (t14 - t20) * 0.707106781187;
	t08 += t20;
	t14 = t02 + t10; t02 = (t02 - t10) * 0.541196100146;
	t10 = t04 + t22; t22 = (t04 - t22) * 1.30656296488;
	t04 = t14 + t10; t10 = (t14 - t10) * 0.707106781187;
	t14 = t02 + t22; t02 = (t02 - t22) * 0.707106781187;
	t14 += t02;	t04 += t14;	t14 += t10;	t10 += t02;
	t16 += t04;	t04 += t08;	t08 += t14;	t14 += t28;
	t28 += t10;	t10 += t20;	t20 += t02;	t21 += t16;
	t16 += t32;	t32 += t04;	t04 += t06;	t06 += t08;
	t08 += t18;	t18 += t14;	t14 += t30;	t30 += t28;
	t28 += t26;	t26 += t10;	t10 += t12;	t12 += t20;
	t20 += t24;	t24 += t02;

	d[dp + 48] = -t33;
	d[dp + 49] = d[dp + 47] = -t21;
	d[dp + 50] = d[dp + 46] = -t17;
	d[dp + 51] = d[dp + 45] = -t16;
	d[dp + 52] = d[dp + 44] = -t01;
	d[dp + 53] = d[dp + 43] = -t32;
	d[dp + 54] = d[dp + 42] = -t29;
	d[dp + 55] = d[dp + 41] = -t04;
	d[dp + 56] = d[dp + 40] = -t03;
	d[dp + 57] = d[dp + 39] = -t06;
	d[dp + 58] = d[dp + 38] = -t25;
	d[dp + 59] = d[dp + 37] = -t08;
	d[dp + 60] = d[dp + 36] = -t11;
	d[dp + 61] = d[dp + 35] = -t18;
	d[dp + 62] = d[dp + 34] = -t09;
	d[dp + 63] = d[dp + 33] = -t14;
	d[dp + 32] = -t05;
	d[dp +  0] = t05; d[dp + 31] = -t30;
	d[dp +  1] = t30; d[dp + 30] = -t27;
	d[dp +  2] = t27; d[dp + 29] = -t28;
	d[dp +  3] = t28; d[dp + 28] = -t07;
	d[dp +  4] = t07; d[dp + 27] = -t26;
	d[dp +  5] = t26; d[dp + 26] = -t23;
	d[dp +  6] = t23; d[dp + 25] = -t10;
	d[dp +  7] = t10; d[dp + 24] = -t15;
	d[dp +  8] = t15; d[dp + 23] = -t12;
	d[dp +  9] = t12; d[dp + 22] = -t19;
	d[dp + 10] = t19; d[dp + 21] = -t20;
	d[dp + 11] = t20; d[dp + 20] = -t13;
	d[dp + 12] = t13; d[dp + 19] = -t24;
	d[dp + 13] = t24; d[dp + 18] = -t31;
	d[dp + 14] = t31; d[dp + 17] = -t02;
	d[dp + 15] = t02; d[dp + 16] =  0.0;
};

