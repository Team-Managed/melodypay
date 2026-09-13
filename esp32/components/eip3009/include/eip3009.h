#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

#define ARC_CHAIN_ID 5042002ULL

extern const uint8_t ARC_CANONICAL_USDC_ADDRESS[20];

typedef struct {
    uint64_t chain_id;
    uint8_t token_address[20];
    uint8_t authorizer[20];
    uint8_t recipient[20];
    uint8_t value[32];
    uint64_t valid_after;
    uint64_t valid_before;
    uint8_t nonce[32];
} eip3009_authorization_t;

esp_err_t eip3009_validate_request(const eip3009_authorization_t *authorization);
esp_err_t eip3009_compute_receive_digest(const eip3009_authorization_t *authorization, uint8_t digest[32]);
