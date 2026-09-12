#pragma once

#include <stddef.h>
#include <stdint.h>

void evm_keccak256(const uint8_t *input, size_t length, uint8_t output[32]);
