#pragma once

#include "esp_err.h"
#include <stddef.h>
#include <stdint.h>

#define GGWAVE_TRANSPORT_PAYLOAD_BYTES 64

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t ggwave_transport_init(void);
size_t ggwave_transport_encode_size(const uint8_t *payload, size_t payload_size);
int ggwave_transport_encode(const uint8_t *payload, size_t payload_size, int16_t *samples, size_t sample_capacity);
int ggwave_transport_decode(const int16_t *samples, size_t sample_count, uint8_t *payload, size_t payload_capacity);
int ggwave_transport_self_test(void);

#ifdef __cplusplus
}
#endif
