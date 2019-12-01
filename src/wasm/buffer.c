#include <string.h>
#include <stdbool.h>
#include <stdlib.h>

#include "buffer.h"

typedef struct bit_buffer_t {
	uint8_t *bytes;
	unsigned int index;
	unsigned int byte_capacity;
	unsigned int byte_length;
	bit_buffer_mode_t mode;
} bit_buffer_t;

void bit_buffer_resize(bit_buffer_t *self, unsigned int byte_capacity);
void bit_buffer_evict(bit_buffer_t *self, unsigned int bytes_needed);



bit_buffer_t *bit_buffer_create(unsigned int initial_byte_capacity, bit_buffer_mode_t mode) {
	bit_buffer_t *self = malloc(sizeof(bit_buffer_t));
	memset(self, 0, sizeof(bit_buffer_t));
	self->mode = mode;
	self->bytes = malloc(initial_byte_capacity);
	self->byte_capacity = initial_byte_capacity;
	self->byte_length = 0;
	self->index = 0;
	return self;
}


void bit_buffer_destroy(bit_buffer_t *self) {
	free(self->bytes);
	free(self);
}


int bit_buffer_get_index(bit_buffer_t *self) {
	return self->index;
}


void bit_buffer_set_index(bit_buffer_t *self, unsigned int index) {
	self->index = index; // TODO check validity!
}


uint8_t *bit_buffer_get_write_ptr(bit_buffer_t *self, unsigned int bytes_to_write) {
	int bytes_available = self->byte_capacity - self->byte_length;

	if (bytes_to_write > bytes_available) {
		if (self->mode == BIT_BUFFER_MODE_EXPAND) {
			int new_byte_capacity = self->byte_capacity * 2;
			if (new_byte_capacity + bytes_available < bytes_to_write) {
				new_byte_capacity = bytes_to_write - bytes_available;
			}
			bit_buffer_resize(self, new_byte_capacity);
		}
		else {
			bit_buffer_evict(self, bytes_to_write);
		}
	}

	return self->bytes + self->byte_length;
};


void bit_buffer_did_write(bit_buffer_t *self, unsigned int bytes_written) {
	self->byte_length += bytes_written;
}


int bit_buffer_find_next_start_code(bit_buffer_t *self) {
	for (int i = ((self->index + 7) >> 3); i < self->byte_length; i++) {
		if(
			self->bytes[i] == 0x00 &&
			self->bytes[i+1] == 0x00 &&
			self->bytes[i+2] == 0x01
		) {
			self->index = (i+4) << 3;
			return self->bytes[i+3];
		}
	}
	self->index = (self->byte_length << 3);
	return -1;
}


int bit_buffer_find_start_code(bit_buffer_t *self, int code) {
	int current = 0;
	while (true) {
		current = bit_buffer_find_next_start_code(self);
		if (current == code || current == -1) {
			return current;
		}
	}
	return -1;
}


int bit_buffer_next_bytes_are_start_code(bit_buffer_t *self) {
	int i = ((self->index + 7) >> 3);
	return (
		i >= self->byte_length || (
			self->bytes[i] == 0x00 && 
			self->bytes[i+1] == 0x00 &&
			self->bytes[i+2] == 0x01
		)
	);
}


int bit_buffer_peek(bit_buffer_t *self, unsigned int count) {
	int offset = self->index;
	int value = 0;
	while (count) {
		int current_byte = self->bytes[offset >> 3];
		int remaining = 8 - (offset & 7); // remaining bits in byte
		int read = remaining < count ? remaining : count; // bits in self run
		int shift = remaining - read;
		int mask = (0xff >> (8-read));

		value = (value << read) | ((current_byte & (mask << shift)) >> shift);

		offset += read;
		count -= read;
	}

	return value;
}


int bit_buffer_read(bit_buffer_t *self, unsigned int count) {
	int value = bit_buffer_peek(self, count);
	self->index += count;
	return value;
}


int bit_buffer_skip(bit_buffer_t *self, unsigned int count) {
	return (self->index += count);
}


void bit_buffer_rewind(bit_buffer_t *self, unsigned int count) {
	self->index = self->index - count;
	if (self->index < 0) {
		self->index = 0;
	}
}


int bit_buffer_has(bit_buffer_t *self, unsigned int count) {
	return ((self->byte_length << 3) - self->index) >= count;
}


void bit_buffer_resize(bit_buffer_t *self, unsigned int byte_capacity) {
	self->bytes = realloc(self->bytes, byte_capacity);
	self->byte_capacity = byte_capacity;
	if (self->index > self->byte_length << 3) {
		self->index = self->byte_length << 3;
	}
}


void bit_buffer_evict(bit_buffer_t *self, unsigned int bytes_needed) {
	int byte_pos = self->index >> 3;
	int bytes_available = self->byte_capacity - self->byte_length;
	
	// If the current index is the write position, we can simply reset both
	// to 0. Also reset (and throw away yet unread data) if we won't be able
	// to fit the new data in even after a normal eviction.
	if (
		byte_pos == self->byte_length ||
		bytes_needed > bytes_available + byte_pos // emergency evac
	) {
		self->byte_length = 0;
		self->index = 0;
		return;
	}
	else if (byte_pos == 0) {
		// Nothing read yet - we can't evict anything
		return;
	}

	memmove(self->bytes, self->bytes + byte_pos, self->byte_length - byte_pos);
	self->byte_length -= byte_pos;
	self->index -= byte_pos << 3;
}
