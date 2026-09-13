#include "eip3009.h"

#include "keccak.h"
#include <string.h>

const uint8_t ARC_CANONICAL_USDC_ADDRESS[20] = {
    0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
};

static const uint8_t arc_domain_separator[32] = {
    0x36, 0x11, 0x91, 0x52, 0x24, 0x83, 0xd3, 0x2a,
    0x83, 0xe7, 0x0a, 0xe7, 0x18, 0x3b, 0x4b, 0x96,
    0x29, 0x44, 0x2c, 0x13, 0xa7, 0x8b, 0xc9, 0x92,
    0x1d, 0x6f, 0x70, 0x79, 0x11, 0xc8, 0xc6, 0xb0,
};

static const uint8_t receive_typehash[32] = {
    0xd0, 0x99, 0xcc, 0x98, 0xef, 0x71, 0x10, 0x7a,
    0x61, 0x6c, 0x4f, 0x0f, 0x94, 0x1f, 0x04, 0xc3,
    0x22, 0xd8, 0xe2, 0x54, 0xfe, 0x26, 0xb3, 0xc6,
    0x66, 0x8d, 0xb8, 0x7a, 0xae, 0x41, 0x3d, 0xe8,
};

static bool is_zero(const uint8_t *value, size_t length)
{
    for (size_t index = 0; index < length; index++) if (value[index] != 0) return false;
    return true;
}

esp_err_t eip3009_validate_request(const eip3009_authorization_t *authorization)
{
    if (authorization == NULL) return ESP_ERR_INVALID_ARG;
    if (authorization->chain_id != ARC_CHAIN_ID) return ESP_ERR_NOT_SUPPORTED;
    if (memcmp(authorization->token_address, ARC_CANONICAL_USDC_ADDRESS, 20) != 0) return ESP_ERR_NOT_SUPPORTED;
    if (is_zero(authorization->authorizer, 20) || is_zero(authorization->recipient, 20)) return ESP_ERR_INVALID_ARG;
    if (is_zero(authorization->value, 32) || is_zero(authorization->nonce, 32)) return ESP_ERR_INVALID_ARG;
    if (authorization->valid_before <= authorization->valid_after) return ESP_ERR_INVALID_STATE;
    return ESP_OK;
}

esp_err_t eip3009_compute_receive_digest(const eip3009_authorization_t *authorization, uint8_t digest[32])
{
    if (digest == NULL) return ESP_ERR_INVALID_ARG;
    esp_err_t result = eip3009_validate_request(authorization);
    if (result != ESP_OK) return result;

    uint8_t encoded[224] = {0};
    memcpy(encoded, receive_typehash, 32);
    memcpy(encoded + 44, authorization->authorizer, 20);
    memcpy(encoded + 76, authorization->recipient, 20);
    memcpy(encoded + 96, authorization->value, 32);
    for (uint8_t index = 0; index < 8; index++) {
        encoded[152 + index] = (uint8_t)(authorization->valid_after >> ((7 - index) * 8));
        encoded[184 + index] = (uint8_t)(authorization->valid_before >> ((7 - index) * 8));
    }
    memcpy(encoded + 192, authorization->nonce, 32);

    uint8_t struct_hash[32];
    evm_keccak256(encoded, sizeof(encoded), struct_hash);
    uint8_t final_data[66] = {0x19, 0x01};
    memcpy(final_data + 2, arc_domain_separator, 32);
    memcpy(final_data + 34, struct_hash, 32);
    evm_keccak256(final_data, sizeof(final_data), digest);
    memset(encoded, 0, sizeof(encoded));
    memset(struct_hash, 0, sizeof(struct_hash));
    memset(final_data, 0, sizeof(final_data));
    return ESP_OK;
}
