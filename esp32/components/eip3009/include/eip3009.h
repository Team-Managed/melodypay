#pragma once

#if defined(ESP_PLATFORM)
#include "esp_err.h"
#else
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERR_NO_MEM 0x101
#define ESP_ERR_INVALID_ARG 0x102
#define ESP_ERR_INVALID_STATE 0x103
#define ESP_ERR_INVALID_SIZE 0x104
#define ESP_ERR_NOT_FOUND 0x105
#define ESP_ERR_NOT_SUPPORTED 0x106
#define ESP_ERR_TIMEOUT 0x107
#define ESP_ERR_INVALID_RESPONSE 0x108
#define ESP_ERR_INVALID_CRC 0x109
#define ESP_ERR_INVALID_VERSION 0x10A
#endif
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define ARC_CHAIN_ID 5042002ULL
#define ARC_USDC_DECIMALS 6

// Canonical Arc native USDC precompile address: 0x3600000000000000000000000000000000000000
extern const uint8_t ARC_CANONICAL_USDC_ADDRESS[20];

// Official EIP-712 domain separator and typehashes verified against Arc RPC and ethers
extern const uint8_t ARC_USDC_DOMAIN_SEPARATOR[32];
extern const uint8_t EIP3009_RECEIVE_TYPEHASH[32];
extern const uint8_t EIP3009_TRANSFER_TYPEHASH[32];

typedef struct {
    uint64_t chain_id;
    uint8_t token_address[20];
    uint8_t authorizer[20];
    uint8_t recipient[20];
    uint8_t value[32];       // Big-endian uint256 token value
    uint64_t valid_after;
    uint64_t valid_before;
    uint8_t nonce[32];       // 32-byte authorization nonce
} eip3009_authorization_t;

typedef struct {
    eip3009_authorization_t auth;
    uint8_t v;
    uint8_t r[32];
    uint8_t s[32];
} eip3009_signed_authorization_t;

/**
 * Validates an authorization request against Arc network and USDC policy rules.
 */
esp_err_t eip3009_validate_request(const eip3009_authorization_t *auth);

/**
 * Computes the canonical EIP-712 digest for a ReceiveWithAuthorization payload.
 * Digest = keccak256("\x19\x01" || domainSeparator || structHash)
 */
esp_err_t eip3009_compute_receive_digest(const eip3009_authorization_t *auth, uint8_t digest_out[32]);

/**
 * Signs the authorization digest.
 * Fails closed with ESP_ERR_NOT_SUPPORTED until a reviewed secure element
 * or hardware secp256k1 backend is linked.
 */
esp_err_t eip3009_sign_authorization(const eip3009_authorization_t *auth,
                                     eip3009_signed_authorization_t *signed_out);

/**
 * Securely zeroes out memory containing sensitive authorizations or signatures.
 */
void eip3009_wipe_memory(void *buffer, size_t length);

/**
 * Formats user review strings for ESP32 OLED display before physical hold-to-approve.
 */
esp_err_t eip3009_format_display(const eip3009_authorization_t *auth,
                                 char *line1, size_t line1_size,
                                 char *line2, size_t line2_size);
