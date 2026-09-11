#include "protocol.h"

#include <string.h>

uint8_t melody_crc8(const uint8_t *data, size_t length)
{
    uint8_t crc = 0;
    for (size_t index = 0; index < length; index++) {
        crc ^= data[index];
        for (uint8_t bit = 0; bit < 8; bit++) {
            crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x07) : (uint8_t)(crc << 1);
        }
    }
    return crc;
}

esp_err_t melody_frame_encode(uint16_t message_id, uint8_t chunk_index, uint8_t total_chunks,
                              const uint8_t *payload, uint8_t payload_length,
                              uint8_t *output, size_t output_capacity, size_t *output_length)
{
    if (payload == NULL || output == NULL || output_length == NULL) return ESP_ERR_INVALID_ARG;
    if (total_chunks == 0 || chunk_index >= total_chunks || payload_length > MELODY_MAX_CHUNK_PAYLOAD) {
        return ESP_ERR_INVALID_ARG;
    }
    if (output_capacity < MELODY_CHUNK_HEADER_SIZE + payload_length) return ESP_ERR_INVALID_SIZE;

    output[0] = MELODY_PROTOCOL_MAGIC;
    output[1] = MELODY_PROTOCOL_VERSION;
    output[2] = (uint8_t)(message_id >> 8);
    output[3] = (uint8_t)(message_id & 0xff);
    output[4] = chunk_index;
    output[5] = total_chunks;
    output[6] = payload_length;
    output[7] = 0;
    memcpy(output + MELODY_CHUNK_HEADER_SIZE, payload, payload_length);
    output[7] = melody_crc8(output, 7 + payload_length);
    *output_length = MELODY_CHUNK_HEADER_SIZE + payload_length;
    return ESP_OK;
}

esp_err_t melody_frame_decode(const uint8_t *frame, size_t frame_length, melody_frame_t *decoded)
{
    if (frame == NULL || decoded == NULL || frame_length < MELODY_CHUNK_HEADER_SIZE) return ESP_ERR_INVALID_ARG;
    if (frame[0] != MELODY_PROTOCOL_MAGIC || frame[1] != MELODY_PROTOCOL_VERSION) return ESP_ERR_INVALID_VERSION;
    if (frame[5] == 0 || frame[4] >= frame[5]) return ESP_ERR_INVALID_ARG;
    if (frame[6] > MELODY_MAX_CHUNK_PAYLOAD || frame_length != MELODY_CHUNK_HEADER_SIZE + frame[6]) return ESP_ERR_INVALID_SIZE;

    uint8_t expected_crc = frame[7];
    uint8_t header_and_payload[MELODY_CHUNK_HEADER_SIZE + MELODY_MAX_CHUNK_PAYLOAD];
    memcpy(header_and_payload, frame, frame_length);
    header_and_payload[7] = 0;
    if (melody_crc8(header_and_payload, frame_length) != expected_crc) return ESP_ERR_INVALID_CRC;

    decoded->message_id = (uint16_t)((frame[2] << 8) | frame[3]);
    decoded->chunk_index = frame[4];
    decoded->total_chunks = frame[5];
    decoded->payload = frame + MELODY_CHUNK_HEADER_SIZE;
    decoded->payload_length = frame[6];
    return ESP_OK;
}
