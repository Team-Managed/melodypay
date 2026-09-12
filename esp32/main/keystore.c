#include "keystore.h"
#include "evm_tx.h"
#include "evm_self_test.h"
#include "keccak.h"

#include "nvs.h"
#include "nvs_flash.h"
#include "esp_random.h"
#include "esp_log.h"
#include "mbedtls/ecp.h"
#include "mbedtls/ecdsa.h"
#include "mbedtls/md.h"
#include "mbedtls/platform_util.h"
#include <string.h>

static const char *TAG = "keystore";
static uint8_t development_key[32];
static uint8_t wallet_address[20];
static mbedtls_ecp_group secp256k1_group;
static mbedtls_ecp_point public_point;
static bool key_loaded;
static bool contexts_initialized;

static void free_crypto_contexts(void)
{
    if (!contexts_initialized) return;
    mbedtls_ecp_point_free(&public_point);
    mbedtls_ecp_group_free(&secp256k1_group);
    contexts_initialized = false;
    key_loaded = false;
    memset(wallet_address, 0, sizeof(wallet_address));
}

static int crypto_rng(void *context, unsigned char *output, size_t length)
{
    (void)context;
    esp_fill_random(output, length);
    return 0;
}

static int recover_public_key(const uint8_t digest[32], const mbedtls_mpi *r,
                              const mbedtls_mpi *s, unsigned recovery_id,
                              mbedtls_ecp_point *recovered)
{
    mbedtls_mpi x;
    mbedtls_mpi y_squared;
    mbedtls_mpi exponent;
    mbedtls_mpi z;
    mbedtls_mpi inverse_r;
    mbedtls_mpi u1;
    mbedtls_mpi u2;
    mbedtls_ecp_point candidate;
    int result = -1;
    mbedtls_mpi_init(&x);
    mbedtls_mpi_init(&y_squared);
    mbedtls_mpi_init(&exponent);
    mbedtls_mpi_init(&z);
    mbedtls_mpi_init(&inverse_r);
    mbedtls_mpi_init(&u1);
    mbedtls_mpi_init(&u2);
    mbedtls_ecp_point_init(&candidate);
    if (recovery_id > 3 || mbedtls_mpi_copy(&x, r) != 0) goto cleanup;
    if ((recovery_id >> 1) != 0 && mbedtls_mpi_add_mpi(&x, &x, &secp256k1_group.N) != 0) goto cleanup;
    if (mbedtls_mpi_cmp_mpi(&x, &secp256k1_group.P) >= 0) goto cleanup;
    if (mbedtls_mpi_mul_mpi(&y_squared, &x, &x) != 0 ||
        mbedtls_mpi_mul_mpi(&y_squared, &y_squared, &x) != 0 ||
        mbedtls_mpi_add_int(&y_squared, &y_squared, 7) != 0 ||
        mbedtls_mpi_mod_mpi(&y_squared, &y_squared, &secp256k1_group.P) != 0) goto cleanup;
    if (mbedtls_mpi_add_int(&exponent, &secp256k1_group.P, 1) != 0 ||
        mbedtls_mpi_shift_r(&exponent, 2) != 0 ||
        mbedtls_mpi_exp_mod(&candidate.MBEDTLS_PRIVATE(Y), &y_squared, &exponent,
                            &secp256k1_group.P, NULL) != 0) goto cleanup;
    if ((mbedtls_mpi_get_bit(&candidate.MBEDTLS_PRIVATE(Y), 0) != (int)(recovery_id & 1)) &&
        mbedtls_mpi_sub_mpi(&candidate.MBEDTLS_PRIVATE(Y), &secp256k1_group.P,
                            &candidate.MBEDTLS_PRIVATE(Y)) != 0) goto cleanup;
    if (mbedtls_mpi_copy(&candidate.MBEDTLS_PRIVATE(X), &x) != 0 ||
        mbedtls_mpi_lset(&candidate.MBEDTLS_PRIVATE(Z), 1) != 0 ||
        mbedtls_ecp_check_pubkey(&secp256k1_group, &candidate) != 0) goto cleanup;
    if (mbedtls_mpi_read_binary(&z, digest, 32) != 0 ||
        mbedtls_mpi_mod_mpi(&z, &z, &secp256k1_group.N) != 0 ||
        mbedtls_mpi_inv_mod(&inverse_r, r, &secp256k1_group.N) != 0 ||
        mbedtls_mpi_mul_mpi(&u1, &z, &inverse_r) != 0 ||
        mbedtls_mpi_mod_mpi(&u1, &u1, &secp256k1_group.N) != 0 ||
        mbedtls_mpi_sub_mpi(&u1, &secp256k1_group.N, &u1) != 0 ||
        mbedtls_mpi_mul_mpi(&u2, s, &inverse_r) != 0 ||
        mbedtls_mpi_mod_mpi(&u2, &u2, &secp256k1_group.N) != 0 ||
        mbedtls_ecp_muladd(&secp256k1_group, recovered, &u1, &secp256k1_group.G,
                           &u2, &candidate) != 0) goto cleanup;
    if (mbedtls_ecp_check_pubkey(&secp256k1_group, recovered) != 0) goto cleanup;
    result = 0;
cleanup:
    mbedtls_mpi_free(&x);
    mbedtls_mpi_free(&y_squared);
    mbedtls_mpi_free(&exponent);
    mbedtls_mpi_free(&z);
    mbedtls_mpi_free(&inverse_r);
    mbedtls_mpi_free(&u1);
    mbedtls_mpi_free(&u2);
    mbedtls_ecp_point_free(&candidate);
    return result;
}

static esp_err_t sign_digest(const uint8_t digest[32], uint8_t signature[65], size_t capacity)
{
    if (!key_loaded) return ESP_ERR_INVALID_STATE;
    if (digest == NULL || signature == NULL || capacity < 65) return ESP_ERR_INVALID_SIZE;
    mbedtls_mpi private_scalar;
    mbedtls_mpi r;
    mbedtls_mpi s;
    uint8_t serialized[32];
    esp_err_t result = ESP_FAIL;
    mbedtls_ecp_point recovered_point;
    bool recovered_point_initialized = false;
    mbedtls_mpi_init(&private_scalar);
    mbedtls_mpi_init(&r);
    mbedtls_mpi_init(&s);
    mbedtls_ecp_point_init(&recovered_point);
    recovered_point_initialized = true;
    if (mbedtls_mpi_read_binary(&private_scalar, development_key, sizeof(development_key)) != 0) goto cleanup;
    if (mbedtls_ecdsa_sign_det_ext(&secp256k1_group, &r, &s, &private_scalar, digest, 32,
                                   MBEDTLS_MD_SHA256, crypto_rng, NULL) != 0) goto cleanup;
    if (mbedtls_mpi_cmp_mpi(&s, &secp256k1_group.N) >= 0) goto cleanup;
    unsigned recovery_id = 0;
    bool recovered = false;
    for (unsigned candidate_id = 0; candidate_id < 4; candidate_id++) {
        if (recover_public_key(digest, &r, &s, candidate_id, &recovered_point) == 0 &&
            mbedtls_mpi_cmp_mpi(&recovered_point.MBEDTLS_PRIVATE(X), &public_point.MBEDTLS_PRIVATE(X)) == 0 &&
            mbedtls_mpi_cmp_mpi(&recovered_point.MBEDTLS_PRIVATE(Y), &public_point.MBEDTLS_PRIVATE(Y)) == 0) {
            recovery_id = candidate_id;
            recovered = true;
            break;
        }
    }
    if (!recovered) {
        goto cleanup;
    }
    {
        mbedtls_mpi half_order;
        mbedtls_mpi_init(&half_order);
        if (mbedtls_mpi_copy(&half_order, &secp256k1_group.N) != 0 ||
            mbedtls_mpi_shift_r(&half_order, 1) != 0) {
            mbedtls_mpi_free(&half_order);
            goto cleanup;
        }
        if (mbedtls_mpi_cmp_mpi(&s, &half_order) > 0) {
            if (mbedtls_mpi_sub_mpi(&s, &secp256k1_group.N, &s) != 0) {
                mbedtls_mpi_free(&half_order);
                goto cleanup;
            }
            recovery_id ^= 1;
        }
        mbedtls_mpi_free(&half_order);
    }
    if (mbedtls_mpi_write_binary(&r, serialized, sizeof(serialized)) != 0) goto cleanup;
    memcpy(signature, serialized, 32);
    if (mbedtls_mpi_write_binary(&s, serialized, sizeof(serialized)) != 0) goto cleanup;
    memcpy(signature + 32, serialized, 32);
    signature[64] = (uint8_t)(recovery_id & 1);
    result = ESP_OK;
cleanup:
    if (recovered_point_initialized) mbedtls_ecp_point_free(&recovered_point);
    memset(serialized, 0, sizeof(serialized));
    mbedtls_mpi_free(&private_scalar);
    mbedtls_mpi_free(&r);
    mbedtls_mpi_free(&s);
    return result;
}

esp_err_t keystore_init(void)
{
    if (key_loaded) return ESP_OK;
    free_crypto_contexts();
    nvs_handle_t handle;
    esp_err_t result = nvs_open("wallet", NVS_READWRITE, &handle);
    if (result != ESP_OK) return result;

    size_t key_size = sizeof(development_key);
    result = nvs_get_blob(handle, "dev_key", development_key, &key_size);
    if (result == ESP_ERR_NVS_NOT_FOUND) {
        mbedtls_ecp_group candidate_group;
        mbedtls_mpi candidate_scalar;
        mbedtls_ecp_group_init(&candidate_group);
        mbedtls_mpi_init(&candidate_scalar);
        result = mbedtls_ecp_group_load(&candidate_group, MBEDTLS_ECP_DP_SECP256K1);
        do {
            if (result != ESP_OK) break;
            esp_fill_random(development_key, sizeof(development_key));
            result = mbedtls_mpi_read_binary(&candidate_scalar, development_key, sizeof(development_key));
        } while (result == ESP_OK && (mbedtls_mpi_cmp_int(&candidate_scalar, 0) <= 0 ||
                                      mbedtls_mpi_cmp_mpi(&candidate_scalar, &candidate_group.N) >= 0));
        mbedtls_mpi_free(&candidate_scalar);
        mbedtls_ecp_group_free(&candidate_group);
        if (result == ESP_OK) result = nvs_set_blob(handle, "dev_key", development_key, sizeof(development_key));
        if (result == ESP_OK) result = nvs_commit(handle);
    }
    nvs_close(handle);

    if (result == ESP_OK && key_size == sizeof(development_key)) {
        mbedtls_mpi private_scalar;
        mbedtls_mpi_init(&private_scalar);
        mbedtls_ecp_group_init(&secp256k1_group);
        mbedtls_ecp_point_init(&public_point);
        contexts_initialized = true;
        result = mbedtls_ecp_group_load(&secp256k1_group, MBEDTLS_ECP_DP_SECP256K1);
        if (result == 0) result = mbedtls_mpi_read_binary(&private_scalar, development_key, sizeof(development_key));
        if (result == 0 && (mbedtls_mpi_cmp_int(&private_scalar, 0) <= 0 ||
                            mbedtls_mpi_cmp_mpi(&private_scalar, &secp256k1_group.N) >= 0)) result = MBEDTLS_ERR_ECP_INVALID_KEY;
        if (result == 0) result = mbedtls_ecp_mul(&secp256k1_group, &public_point, &private_scalar,
                                                  &secp256k1_group.G, crypto_rng, NULL);
        uint8_t public_key[65];
        if (result == 0) {
            size_t public_length = sizeof(public_key);
            result = mbedtls_ecp_point_write_binary(&secp256k1_group, &public_point,
                                                     MBEDTLS_ECP_PF_UNCOMPRESSED, &public_length, public_key, sizeof(public_key));
            if (result == 0) {
                uint8_t hash[32];
                evm_keccak256(public_key + 1, 64, hash);
                memcpy(wallet_address, hash + 12, sizeof(wallet_address));
                memset(hash, 0, sizeof(hash));
            }
        }
        memset(public_key, 0, sizeof(public_key));
        mbedtls_mpi_free(&private_scalar);
        if (result == 0) {
            key_loaded = true;
            evm_register_signer(sign_digest);
        }
        ESP_LOGW(TAG, "development key backend active; unsafe for real funds");
    }
    if (result != ESP_OK) {
        memset(development_key, 0, sizeof(development_key));
        free_crypto_contexts();
        key_loaded = false;
    }
    if (result == ESP_OK && keystore_crypto_self_test() != ESP_OK) {
        evm_register_signer(NULL);
        memset(development_key, 0, sizeof(development_key));
        free_crypto_contexts();
        result = ESP_FAIL;
    }
    return result;
}

esp_err_t keystore_sign_digest(const uint8_t digest[32], uint8_t signature[65], size_t signature_capacity)
{
    return sign_digest(digest, signature, signature_capacity);
}

esp_err_t keystore_get_address(uint8_t address[20])
{
    if (!key_loaded || address == NULL) return ESP_ERR_INVALID_STATE;
    memcpy(address, wallet_address, 20);
    return ESP_OK;
}

esp_err_t keystore_crypto_self_test(void)
{
    if (!key_loaded) return ESP_ERR_INVALID_STATE;
    if (evm_crypto_self_test() != ESP_OK) {
        ESP_LOGE(TAG, "EVM serialization self-test failed");
        return ESP_FAIL;
    }
    static const uint8_t test_digest[32] = {
        0xb3, 0x16, 0x94, 0x42, 0xa2, 0xa5, 0xc8, 0x20,
        0xb5, 0xfa, 0xfa, 0x73, 0x68, 0xec, 0xd9, 0xf6,
        0x6b, 0xa3, 0x7c, 0x46, 0x92, 0x04, 0x4f, 0x47,
        0x26, 0x3e, 0xfb, 0x9f, 0x38, 0x07, 0x68, 0x22,
    };
    uint8_t first[65];
    uint8_t second[65];
    const esp_err_t first_result = sign_digest(test_digest, first, sizeof(first));
    const esp_err_t second_result = sign_digest(test_digest, second, sizeof(second));
    if (first_result != ESP_OK || second_result != ESP_OK ||
        memcmp(first, second, sizeof(first)) != 0 || first[64] > 1) {
        ESP_LOGE(TAG, "real signer self-test failed first=%s second=%s parity=%u",
                 esp_err_to_name(first_result), esp_err_to_name(second_result), first[64]);
        memset(first, 0, sizeof(first));
        memset(second, 0, sizeof(second));
        return ESP_FAIL;
    }
    mbedtls_mpi r;
    mbedtls_mpi s;
    mbedtls_mpi_init(&r);
    mbedtls_mpi_init(&s);
    const int verify_result = mbedtls_mpi_read_binary(&r, first, 32) == 0 &&
        mbedtls_mpi_read_binary(&s, first + 32, 32) == 0 &&
        mbedtls_ecdsa_verify(&secp256k1_group, test_digest, sizeof(test_digest),
                             &public_point, &r, &s);
    mbedtls_mpi_free(&r);
    mbedtls_mpi_free(&s);
    memset(first, 0, sizeof(first));
    memset(second, 0, sizeof(second));
    if (verify_result != 0) ESP_LOGE(TAG, "signature verification self-test failed");
    return verify_result == 0 ? ESP_OK : ESP_FAIL;
}

bool keystore_is_development_backend(void)
{
    return true;
}

bool keystore_is_ready(void)
{
    return key_loaded;
}
