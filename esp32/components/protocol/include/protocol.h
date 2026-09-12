#pragma once

#include "esp_err.h"
#include <stddef.h>
#include <stdint.h>

#define MELODY_PROTOCOL_MAGIC 0x4d
#define MELODY_PROTOCOL_VERSION 0x01
#define MELODY_CHUNK_HEADER_SIZE 8
#define MELODY_MAX_CHUNK_PAYLOAD 128
#define MELODY_MAX_MESSAGE_SIZE 1024

typedef enum {
    MELODY_MSG_HELLO = 0x01,
    MELODY_MSG_PAYMENT_REQUEST = 0x02,
    MELODY_MSG_SIGNED_TRANSACTION = 0x03,
    MELODY_MSG_RECEIPT = 0x04,
    MELODY_MSG_REJECTED = 0x05,
    MELODY_MSG_ERROR = 0x06,
    MELODY_MSG_SIGNED_AUTHORIZATION = 0x07,
} melody_message_type_t;

typedef struct {
    uint16_t message_id;
    uint8_t chunk_index;
    uint8_t total_chunks;
    const uint8_t *payload;
    uint8_t payload_length;
} melody_frame_t;

uint8_t melody_crc8(const uint8_t *data, size_t length);
esp_err_t melody_frame_encode(uint16_t message_id, uint8_t chunk_index, uint8_t total_chunks,
                              const uint8_t *payload, uint8_t payload_length,
                              uint8_t *output, size_t output_capacity, size_t *output_length);
esp_err_t melody_frame_decode(const uint8_t *frame, size_t frame_length, melody_frame_t *decoded);
