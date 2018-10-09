#ifndef MP2_H
#define MP2_H

#include <stdbool.h>
#include <stdint.h>
#include "buffer.h"

typedef struct mp2_decoder_t mp2_decoder_t;

mp2_decoder_t *mp2_decoder_create(unsigned int buffer_size, bit_buffer_mode_t buffer_mode);
void mp2_decoder_destroy(mp2_decoder_t *self);
void *mp2_decoder_get_write_ptr(mp2_decoder_t *self, unsigned int byte_size);
int mp2_decoder_get_index(mp2_decoder_t *self);
void mp2_decoder_set_index(mp2_decoder_t *self, unsigned int index);
void mp2_decoder_did_write(mp2_decoder_t *self, unsigned int byte_size);

void *mp2_decoder_get_left_channel_ptr(mp2_decoder_t *self);
void *mp2_decoder_get_right_channel_ptr(mp2_decoder_t *self);
int mp2_decoder_get_sample_rate(mp2_decoder_t *self);
int mp2_decoder_decode(mp2_decoder_t *self);

#endif
