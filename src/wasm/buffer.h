#ifndef BUFFER_H
#define BUFFER_H

#include <stdint.h>

typedef struct bit_buffer_t bit_buffer_t;

typedef enum {
	BIT_BUFFER_MODE_EVICT = 1,
	BIT_BUFFER_MODE_EXPAND = 2
} bit_buffer_mode_t;


bit_buffer_t *bit_buffer_create(unsigned int initial_byte_capacity, bit_buffer_mode_t mode);
void bit_buffer_destroy(bit_buffer_t *self);

int bit_buffer_get_index(bit_buffer_t *self);
void bit_buffer_set_index(bit_buffer_t *self, unsigned int index);

uint8_t *bit_buffer_get_write_ptr(bit_buffer_t *self, unsigned int bytes_to_write);
void bit_buffer_did_write(bit_buffer_t *self, unsigned int bytes_written);
int bit_buffer_find_next_start_code(bit_buffer_t *self);
int bit_buffer_find_start_code(bit_buffer_t *self, int code);
int bit_buffer_next_bytes_are_start_code(bit_buffer_t *self);
int bit_buffer_peek(bit_buffer_t *self, unsigned int count);
int bit_buffer_read(bit_buffer_t *self, unsigned int count);
int bit_buffer_skip(bit_buffer_t *self, unsigned int count);
int bit_buffer_has(bit_buffer_t *self, unsigned int count);
void bit_buffer_rewind(bit_buffer_t *self, unsigned int count);

#endif
