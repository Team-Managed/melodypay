#include "eip3009.h"

#include <stdio.h>
#include <string.h>
#include <assert.h>

#define TEST_ASSERT(cond, msg) do { \
    if (!(cond)) { \
        printf("FAILED: %s (%s:%d)\n", msg, __FILE__, __LINE__); \
        return -1; \
    } \
} while(0)

static int test_arc_constants(void)
{
    TEST_ASSERT(ARC_CHAIN_ID == 5042002ULL, "Arc chain ID mismatch");
    TEST_ASSERT(ARC_USDC_DECIMALS == 6, "Arc USDC decimals mismatch");

    uint8_t expected_usdc[20] = {0x36};
    TEST_ASSERT(memcmp(ARC_CANONICAL_USDC_ADDRESS, expected_usdc, 20) == 0, "USDC address mismatch");

    // Domain separator: 0x361191522483d32a83e70ae7183b4b9629442c13a78bc9921d6f707911c8c6b0
    const uint8_t expected_ds[32] = {
        0x36, 0x11, 0x91, 0x52, 0x24, 0x83, 0xd3, 0x2a,
        0x83, 0xe7, 0x0a, 0xe7, 0x18, 0x3b, 0x4b, 0x96,
        0x29, 0x44, 0x2c, 0x13, 0xa7, 0x8b, 0xc9, 0x92,
        0x1d, 0x6f, 0x70, 0x79, 0x11, 0xc8, 0xc6, 0xb0
    };
    TEST_ASSERT(memcmp(ARC_USDC_DOMAIN_SEPARATOR, expected_ds, 32) == 0, "Domain separator mismatch");

    // Receive typehash: 0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8
    const uint8_t expected_typehash[32] = {
        0xd0, 0x99, 0xcc, 0x98, 0xef, 0x71, 0x10, 0x7a,
        0x61, 0x6c, 0x4f, 0x0f, 0x94, 0x1f, 0x04, 0xc3,
        0x22, 0xd8, 0xe2, 0x54, 0xfe, 0x26, 0xb3, 0xc6,
        0x66, 0x8d, 0xb8, 0x7a, 0xae, 0x41, 0x3d, 0xe8
    };
    TEST_ASSERT(memcmp(EIP3009_RECEIVE_TYPEHASH, expected_typehash, 32) == 0, "Receive typehash mismatch");

    return 0;
}

static int test_golden_digest_vector(void)
{
    eip3009_authorization_t auth;
    memset(&auth, 0, sizeof(auth));

    auth.chain_id = ARC_CHAIN_ID;
    memcpy(auth.token_address, ARC_CANONICAL_USDC_ADDRESS, 20);
    memset(auth.authorizer, 0x11, 20);
    memset(auth.recipient, 0x22, 20);

    // 1_000_000n = 0x0f4240 in big-endian (last 3 bytes)
    auth.value[29] = 0x0f;
    auth.value[30] = 0x42;
    auth.value[31] = 0x40;

    auth.valid_after = 0;
    auth.valid_before = 1700000000ULL;
    memset(auth.nonce, 0x01, 32);

    uint8_t digest[32];
    esp_err_t err = eip3009_compute_receive_digest(&auth, digest);
    TEST_ASSERT(err == ESP_OK, "Compute receive digest failed");

    // Golden vector: 0x0eeee1ca40c2724051c0328401cd7ae697b99bdf8c2f4d9f52a7e3dba89805d9
    const uint8_t expected_digest[32] = {
        0x0e, 0xee, 0xe1, 0xca, 0x40, 0xc2, 0x72, 0x40,
        0x51, 0xc0, 0x32, 0x84, 0x01, 0xcd, 0x7a, 0xe6,
        0x97, 0xb9, 0x9b, 0xdf, 0x8c, 0x2f, 0x4d, 0x9f,
        0x52, 0xa7, 0xe3, 0xdb, 0xa8, 0x98, 0x05, 0xd9
    };

    TEST_ASSERT(memcmp(digest, expected_digest, 32) == 0, "Golden digest vector mismatch");
    return 0;
}

static int test_validation_rules(void)
{
    eip3009_authorization_t auth;
    memset(&auth, 0, sizeof(auth));

    auth.chain_id = ARC_CHAIN_ID;
    memcpy(auth.token_address, ARC_CANONICAL_USDC_ADDRESS, 20);
    memset(auth.authorizer, 0x11, 20);
    memset(auth.recipient, 0x22, 20);
    auth.value[31] = 1;
    auth.valid_after = 0;
    auth.valid_before = 1000;
    memset(auth.nonce, 0x01, 32);

    // Valid baseline
    TEST_ASSERT(eip3009_validate_request(&auth) == ESP_OK, "Valid auth failed validation");

    // Wrong chain
    auth.chain_id = 1;
    TEST_ASSERT(eip3009_validate_request(&auth) == ESP_ERR_NOT_SUPPORTED, "Accepted wrong chain");
    auth.chain_id = ARC_CHAIN_ID;

    // Wrong token
    auth.token_address[19] = 0x01;
    TEST_ASSERT(eip3009_validate_request(&auth) == ESP_ERR_NOT_SUPPORTED, "Accepted wrong token");
    memcpy(auth.token_address, ARC_CANONICAL_USDC_ADDRESS, 20);

    // Zero recipient
    memset(auth.recipient, 0, 20);
    TEST_ASSERT(eip3009_validate_request(&auth) == ESP_ERR_INVALID_ARG, "Accepted zero recipient");
    memset(auth.recipient, 0x22, 20);

    // Zero value
    memset(auth.value, 0, 32);
    TEST_ASSERT(eip3009_validate_request(&auth) == ESP_ERR_INVALID_ARG, "Accepted zero value");
    auth.value[31] = 1;

    // Expired
    auth.valid_before = auth.valid_after;
    TEST_ASSERT(eip3009_validate_request(&auth) == ESP_ERR_INVALID_STATE, "Accepted expired auth");

    return 0;
}

static int test_mutation_sensitivity(void)
{
    eip3009_authorization_t base;
    memset(&base, 0, sizeof(base));
    base.chain_id = ARC_CHAIN_ID;
    memcpy(base.token_address, ARC_CANONICAL_USDC_ADDRESS, 20);
    memset(base.authorizer, 0x11, 20);
    memset(base.recipient, 0x22, 20);
    base.value[31] = 100;
    base.valid_after = 0;
    base.valid_before = 1000;
    memset(base.nonce, 0x01, 32);

    uint8_t base_digest[32];
    TEST_ASSERT(eip3009_compute_receive_digest(&base, base_digest) == ESP_OK, "Base digest failed");

    // Mutate recipient
    eip3009_authorization_t mutated = base;
    mutated.recipient[0] ^= 0xff;
    uint8_t mut_digest[32];
    TEST_ASSERT(eip3009_compute_receive_digest(&mutated, mut_digest) == ESP_OK, "Mutated digest failed");
    TEST_ASSERT(memcmp(base_digest, mut_digest, 32) != 0, "Mutated recipient produced identical digest");

    // Mutate value
    mutated = base;
    mutated.value[31] = 101;
    TEST_ASSERT(eip3009_compute_receive_digest(&mutated, mut_digest) == ESP_OK, "Mutated digest failed");
    TEST_ASSERT(memcmp(base_digest, mut_digest, 32) != 0, "Mutated value produced identical digest");

    // Mutate nonce
    mutated = base;
    mutated.nonce[0] ^= 0x02;
    TEST_ASSERT(eip3009_compute_receive_digest(&mutated, mut_digest) == ESP_OK, "Mutated digest failed");
    TEST_ASSERT(memcmp(base_digest, mut_digest, 32) != 0, "Mutated nonce produced identical digest");

    return 0;
}

static int test_memory_wipe(void)
{
    uint8_t secret[64];
    memset(secret, 0xaa, sizeof(secret));
    eip3009_wipe_memory(secret, sizeof(secret));

    for (size_t i = 0; i < sizeof(secret); i++) {
        TEST_ASSERT(secret[i] == 0, "Memory wipe failed to zero byte");
    }
    return 0;
}

static int test_display_formatting(void)
{
    eip3009_authorization_t auth;
    memset(&auth, 0, sizeof(auth));
    auth.chain_id = ARC_CHAIN_ID;
    memcpy(auth.token_address, ARC_CANONICAL_USDC_ADDRESS, 20);
    auth.recipient[0] = 0xca;
    auth.recipient[1] = 0xfe;
    auth.recipient[18] = 0x12;
    auth.recipient[19] = 0x34;

    // 5_500_000 units = 5.50 USDC = 0x53ec60
    auth.value[29] = 0x53;
    auth.value[30] = 0xec;
    auth.value[31] = 0x60;

    char line1[32];
    char line2[32];
    esp_err_t err = eip3009_format_display(&auth, line1, sizeof(line1), line2, sizeof(line2));
    TEST_ASSERT(err == ESP_OK, "Format display failed");
    TEST_ASSERT(strcmp(line1, "Pay: 5.50 USDC") == 0, "Display line1 mismatch");
    TEST_ASSERT(strcmp(line2, "To: 0xcafe...1234") == 0, "Display line2 mismatch");

    return 0;
}

int main(void)
{
    printf("Running ESP32 EIP-3009 component tests...\n");

    if (test_arc_constants() != 0) return 1;
    printf("  [PASS] Arc constants and typehashes\n");

    if (test_golden_digest_vector() != 0) return 1;
    printf("  [PASS] Golden digest vector parity with TypeScript test vector\n");

    if (test_validation_rules() != 0) return 1;
    printf("  [PASS] Policy validation rules\n");

    if (test_mutation_sensitivity() != 0) return 1;
    printf("  [PASS] Mutation digest sensitivity\n");

    if (test_memory_wipe() != 0) return 1;
    printf("  [PASS] Volatile memory zeroing\n");

    if (test_display_formatting() != 0) return 1;
    printf("  [PASS] OLED display formatting\n");

    printf("ALL ESP32 EIP-3009 TESTS PASSED!\n");
    return 0;
}
