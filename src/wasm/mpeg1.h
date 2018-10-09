#ifndef MPEG1_H
#define MPEG1_H

#include <stdbool.h>
#include <stdint.h>
#include "buffer.h"

typedef struct mpeg1_decoder_t mpeg1_decoder_t;

mpeg1_decoder_t *mpeg1_decoder_create(unsigned int buffer_size, bit_buffer_mode_t buffer_mode);
void mpeg1_decoder_destroy(mpeg1_decoder_t *self);
void *mpeg1_decoder_get_write_ptr(mpeg1_decoder_t *self, unsigned int byte_size);
int mpeg1_decoder_get_index(mpeg1_decoder_t *self);
void mpeg1_decoder_set_index(mpeg1_decoder_t *self, unsigned int index);
void mpeg1_decoder_did_write(mpeg1_decoder_t *self, unsigned int byte_size);

int mpeg1_decoder_has_sequence_header(mpeg1_decoder_t *self);
float mpeg1_decoder_get_frame_rate(mpeg1_decoder_t *self);
int mpeg1_decoder_get_coded_size(mpeg1_decoder_t *self);
int mpeg1_decoder_get_width(mpeg1_decoder_t *self);
int mpeg1_decoder_get_height(mpeg1_decoder_t *self);
void *mpeg1_decoder_get_y_ptr(mpeg1_decoder_t *self);
void *mpeg1_decoder_get_cr_ptr(mpeg1_decoder_t *self);
void *mpeg1_decoder_get_cb_ptr(mpeg1_decoder_t *self);
bool mpeg1_decoder_decode(mpeg1_decoder_t *self);

#endif
