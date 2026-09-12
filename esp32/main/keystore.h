#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

esp_err_t keystore_init(void);
esp_err_t keystore_sign_digest(const uint8_t digest[32], uint8_t signature[65], size_t signature_capacity);
esp_err_t keystore_get_address(uint8_t address[20]);
esp_err_t keystore_crypto_self_test(void);
bool keystore_is_ready(void);
bool keystore_is_development_backend(void);
