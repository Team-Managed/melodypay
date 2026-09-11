#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef struct {
    uint64_t chain_id;
    uint8_t recipient[20];
    uint8_t value[32];
    uint64_t nonce;
    uint32_t gas_limit;
    uint8_t max_priority_fee_per_gas[32];
    uint8_t max_fee_per_gas[32];
    uint8_t data_length;
} evm_native_transfer_t;

bool evm_chain_is_allowed(uint64_t chain_id);
const char *evm_chain_name(uint64_t chain_id);
const char *evm_chain_symbol(uint64_t chain_id);
esp_err_t evm_validate_native_transfer(const evm_native_transfer_t *transfer);
esp_err_t evm_sign_eip1559(const evm_native_transfer_t *transfer, uint8_t *signed_transaction,
                           size_t capacity, size_t *signed_length);
