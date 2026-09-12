#include "eip3009.h"

#include <string.h>
#include <stdio.h>

const uint8_t ARC_CANONICAL_USDC_ADDRESS[20] = {
    0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
};

// Official EIP-712 domain separator for Arc USDC:
// keccak256(abi.encode(
//   keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
//   keccak256("USDC"),
//   keccak256("2"),
//   5042002,
//   0x3600000000000000000000000000000000000000
// )) = 0x361191522483d32a83e70ae7183b4b9629442c13a78bc9921d6f707911c8c6b0
const uint8_t ARC_USDC_DOMAIN_SEPARATOR[32] = {
    0x36, 0x11, 0x91, 0x52, 0x24, 0x83, 0xd3, 0x2a,
    0x83, 0xe7, 0x0a, 0xe7, 0x18, 0x3b, 0x4b, 0x96,
    0x29, 0x44, 0x2c, 0x13, 0xa7, 0x8b, 0xc9, 0x92,
    0x1d, 0x6f, 0x70, 0x79, 0x11, 0xc8, 0xc6, 0xb0
};

// keccak256("ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
const uint8_t EIP3009_RECEIVE_TYPEHASH[32] = {
    0xd0, 0x99, 0xcc, 0x98, 0xef, 0x71, 0x10, 0x7a,
    0x61, 0x6c, 0x4f, 0x0f, 0x94, 0x1f, 0x04, 0xc3,
    0x22, 0xd8, 0xe2, 0x54, 0xfe, 0x26, 0xb3, 0xc6,
    0x66, 0x8d, 0xb8, 0x7a, 0xae, 0x41, 0x3d, 0xe8
};

// keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
const uint8_t EIP3009_TRANSFER_TYPEHASH[32] = {
    0x7c, 0x7c, 0x6c, 0xdb, 0x67, 0xa1, 0x87, 0x43,
    0xf4, 0x9e, 0xc6, 0xfa, 0x9b, 0x35, 0xf5, 0x0d,
    0x52, 0xed, 0x05, 0xcb, 0xed, 0x4c, 0xc5, 0x92,
    0xe1, 0x3b, 0x44, 0x50, 0x1c, 0x1a, 0x22, 0x67
};

/* -------------------------------------------------------------------------- */
/* Standalone Keccak-256 (Standard Ethereum SHA3)                             */
/* -------------------------------------------------------------------------- */

#define KECCAK_ROUNDS 24
#define KECCAK_RATE_BYTES 136

static const uint64_t keccak_round_constants[KECCAK_ROUNDS] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL,
    0x8000000080008000ULL, 0x000000000000808bULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008aULL,
    0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
    0x000000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL,
    0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800aULL, 0x800000008000000aULL, 0x8000000080008081ULL,
    0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL
};

static const int keccak_rotations[25] = {
     0,  1, 62, 28, 27,
    36, 44,  6, 55, 20,
     3, 10, 43, 25, 39,
    41, 45, 15, 21,  8,
    18,  2, 61, 56, 14
};

static const int keccak_pi[25] = {
     0, 10, 20,  5, 15,
    16,  1, 11, 21,  6,
     7, 17,  2, 12, 22,
    23,  8, 18,  3, 13,
    14, 24,  9, 19,  4
};

static inline uint64_t rotl64(uint64_t x, int n)
{
    return (x << n) | (x >> (64 - n));
}

static void keccak_f1600(uint64_t state[25])
{
    for (int round = 0; round < KECCAK_ROUNDS; round++) {
        // Theta
        uint64_t C[5];
        for (int x = 0; x < 5; x++) {
            C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
        }
        for (int x = 0; x < 5; x++) {
            uint64_t D = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
            for (int y = 0; y < 25; y += 5) {
                state[x + y] ^= D;
            }
        }

        // Rho and Pi
        uint64_t B[25];
        for (int i = 0; i < 25; i++) {
            B[keccak_pi[i]] = rotl64(state[i], keccak_rotations[i]);
        }

        // Chi
        for (int y = 0; y < 25; y += 5) {
            for (int x = 0; x < 5; x++) {
                state[x + y] = B[x + y] ^ ((~B[((x + 1) % 5) + y]) & B[((x + 2) % 5) + y]);
            }
        }

        // Iota
        state[0] ^= keccak_round_constants[round];
    }
}

static void keccak256(const uint8_t *data, size_t length, uint8_t output[32])
{
    uint64_t state[25] = {0};
    uint8_t block[KECCAK_RATE_BYTES];
    size_t offset = 0;

    while (length >= KECCAK_RATE_BYTES) {
        for (size_t i = 0; i < KECCAK_RATE_BYTES / 8; i++) {
            uint64_t word = 0;
            for (int b = 0; b < 8; b++) {
                word |= ((uint64_t)data[offset + i * 8 + b]) << (b * 8);
            }
            state[i] ^= word;
        }
        keccak_f1600(state);
        offset += KECCAK_RATE_BYTES;
        length -= KECCAK_RATE_BYTES;
    }

    // Padding (Ethereum uses 0x01 ... 0x80)
    memset(block, 0, sizeof(block));
    memcpy(block, data + offset, length);
    block[length] = 0x01;
    block[KECCAK_RATE_BYTES - 1] |= 0x80;

    for (size_t i = 0; i < KECCAK_RATE_BYTES / 8; i++) {
        uint64_t word = 0;
        for (int b = 0; b < 8; b++) {
            word |= ((uint64_t)block[i * 8 + b]) << (b * 8);
        }
        state[i] ^= word;
    }
    keccak_f1600(state);

    for (size_t i = 0; i < 4; i++) {
        for (int b = 0; b < 8; b++) {
            output[i * 8 + b] = (uint8_t)((state[i] >> (b * 8)) & 0xff);
        }
    }
}

/* -------------------------------------------------------------------------- */
/* EIP-3009 API Implementation                                                */
/* -------------------------------------------------------------------------- */

esp_err_t eip3009_validate_request(const eip3009_authorization_t *auth)
{
    if (auth == NULL) return ESP_ERR_INVALID_ARG;
    if (auth->chain_id != ARC_CHAIN_ID) return ESP_ERR_NOT_SUPPORTED;

    if (memcmp(auth->token_address, ARC_CANONICAL_USDC_ADDRESS, 20) != 0) {
        return ESP_ERR_NOT_SUPPORTED;
    }

    bool recipient_zero = true;
    for (int i = 0; i < 20; i++) {
        if (auth->recipient[i] != 0) {
            recipient_zero = false;
            break;
        }
    }
    if (recipient_zero) return ESP_ERR_INVALID_ARG;

    bool value_zero = true;
    for (int i = 0; i < 32; i++) {
        if (auth->value[i] != 0) {
            value_zero = false;
            break;
        }
    }
    if (value_zero) return ESP_ERR_INVALID_ARG;

    if (auth->valid_before <= auth->valid_after) return ESP_ERR_INVALID_STATE;

    return ESP_OK;
}

esp_err_t eip3009_compute_receive_digest(const eip3009_authorization_t *auth, uint8_t digest_out[32])
{
    if (auth == NULL || digest_out == NULL) return ESP_ERR_INVALID_ARG;

    esp_err_t validation = eip3009_validate_request(auth);
    if (validation != ESP_OK) return validation;

    // ABI encode 7 fields for ReceiveWithAuthorization:
    // [0..31]:    TYPEHASH
    // [32..63]:   from (address left-padded with 12 zeros)
    // [64..95]:   to (address left-padded with 12 zeros)
    // [96..127]:  value (uint256 big-endian)
    // [128..159]: validAfter (uint256 big-endian, left-padded with 24 zeros)
    // [160..191]: validBefore (uint256 big-endian, left-padded with 24 zeros)
    // [192..223]: nonce (bytes32)
    uint8_t struct_data[224];
    memset(struct_data, 0, sizeof(struct_data));

    // Field 0: Typehash
    memcpy(struct_data, EIP3009_RECEIVE_TYPEHASH, 32);

    // Field 1: from address (12 zeros followed by 20 bytes)
    memcpy(struct_data + 32 + 12, auth->authorizer, 20);

    // Field 2: to address (12 zeros followed by 20 bytes)
    memcpy(struct_data + 64 + 12, auth->recipient, 20);

    // Field 3: value (32 bytes big-endian)
    memcpy(struct_data + 96, auth->value, 32);

    // Field 4: validAfter (uint64 big-endian stored in last 8 bytes of 32-byte slot)
    for (int i = 0; i < 8; i++) {
        struct_data[128 + 24 + i] = (uint8_t)((auth->valid_after >> ((7 - i) * 8)) & 0xff);
    }

    // Field 5: validBefore (uint64 big-endian stored in last 8 bytes of 32-byte slot)
    for (int i = 0; i < 8; i++) {
        struct_data[160 + 24 + i] = (uint8_t)((auth->valid_before >> ((7 - i) * 8)) & 0xff);
    }

    // Field 6: nonce
    memcpy(struct_data + 192, auth->nonce, 32);

    uint8_t struct_hash[32];
    keccak256(struct_data, sizeof(struct_data), struct_hash);

    // EIP-712 final digest: keccak256("\x19\x01" || domainSeparator || structHash)
    uint8_t eip712_data[2 + 32 + 32];
    eip712_data[0] = 0x19;
    eip712_data[1] = 0x01;
    memcpy(eip712_data + 2, ARC_USDC_DOMAIN_SEPARATOR, 32);
    memcpy(eip712_data + 34, struct_hash, 32);

    keccak256(eip712_data, sizeof(eip712_data), digest_out);

    // Clean intermediate memory
    eip3009_wipe_memory(struct_data, sizeof(struct_data));
    eip3009_wipe_memory(struct_hash, sizeof(struct_hash));
    eip3009_wipe_memory(eip712_data, sizeof(eip712_data));

    return ESP_OK;
}

esp_err_t eip3009_sign_authorization(const eip3009_authorization_t *auth,
                                     eip3009_signed_authorization_t *signed_out)
{
    if (auth == NULL || signed_out == NULL) return ESP_ERR_INVALID_ARG;

    uint8_t digest[32];
    esp_err_t result = eip3009_compute_receive_digest(auth, digest);
    if (result != ESP_OK) return result;

    eip3009_wipe_memory(digest, sizeof(digest));

    // Fail closed until a reviewed secure element / hardware secp256k1 engine
    // is configured. Never emit an unsigned or dummy authorization.
    return ESP_ERR_NOT_SUPPORTED;
}

void eip3009_wipe_memory(void *buffer, size_t length)
{
    if (buffer == NULL || length == 0) return;
    volatile uint8_t *p = (volatile uint8_t *)buffer;
    while (length--) {
        *p++ = 0;
    }
}

esp_err_t eip3009_format_display(const eip3009_authorization_t *auth,
                                 char *line1, size_t line1_size,
                                 char *line2, size_t line2_size)
{
    if (auth == NULL || line1 == NULL || line2 == NULL || line1_size == 0 || line2_size == 0) {
        return ESP_ERR_INVALID_ARG;
    }

    // Convert 32-byte big-endian value to uint64 units (USDC has 6 decimals)
    uint64_t low_units = 0;
    for (int i = 24; i < 32; i++) {
        low_units = (low_units << 8) | auth->value[i];
    }
    uint64_t whole = low_units / 1000000ULL;
    uint64_t fraction = low_units % 1000000ULL;

    snprintf(line1, line1_size, "Pay: %llu.%02llu USDC", (unsigned long long)whole, (unsigned long long)(fraction / 10000));
    snprintf(line2, line2_size, "To: 0x%02x%02x...%02x%02x",
             auth->recipient[0], auth->recipient[1],
             auth->recipient[18], auth->recipient[19]);

    return ESP_OK;
}
