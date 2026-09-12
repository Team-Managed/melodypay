#include "evm_tx.h"
#include "keccak.h"

#include <string.h>

#define EVM_MAX_RLP 128

static evm_signer_fn registered_signer;

static size_t significant_bytes(const uint8_t *value, size_t length)
{
    size_t offset = 0;
    while (offset < length && value[offset] == 0) offset++;
    return offset;
}

static esp_err_t rlp_string(const uint8_t *value, size_t length, uint8_t *output, size_t capacity, size_t *written)
{
    const size_t offset = significant_bytes(value, length);
    const uint8_t *data = value + offset;
    const size_t data_length = length - offset;

    if (data_length == 1 && data[0] < 0x80) {
        if (capacity < 1) return ESP_ERR_INVALID_SIZE;
        output[0] = data[0];
        *written = 1;
        return ESP_OK;
    }
    if (data_length > 55 || capacity < data_length + 1) return ESP_ERR_INVALID_SIZE;
    output[0] = (uint8_t)(0x80 + data_length);
    if (data_length > 0) memcpy(output + 1, data, data_length);
    *written = data_length + 1;
    return ESP_OK;
}

static esp_err_t append_rlp(const uint8_t *value, size_t value_length, uint8_t *items, size_t *items_length)
{
    size_t written = 0;
    if (*items_length >= EVM_MAX_RLP) return ESP_ERR_INVALID_SIZE;
    static const uint8_t empty = 0;
    if (value == NULL && value_length == 0) value = &empty;
    esp_err_t result = rlp_string(value, value_length, items + *items_length,
                                  EVM_MAX_RLP - *items_length, &written);
    if (result == ESP_OK) *items_length += written;
    return result;
}

static esp_err_t append_empty_list(uint8_t *items, size_t *items_length)
{
    if (*items_length >= EVM_MAX_RLP) return ESP_ERR_INVALID_SIZE;
    items[(*items_length)++] = 0xc0;
    return ESP_OK;
}

static esp_err_t encode_list(const uint8_t *items, size_t items_length,
                             uint8_t *output, size_t capacity, size_t *written)
{
    const size_t prefix_length = items_length <= 55 ? 1 : (items_length <= 255 ? 2 : 0);
    if (prefix_length == 0 || capacity < prefix_length + items_length) return ESP_ERR_INVALID_SIZE;
    if (items_length <= 55) {
        output[0] = (uint8_t)(0xc0 + items_length);
    } else {
        output[0] = 0xf8;
        output[1] = (uint8_t)items_length;
    }
    memcpy(output + prefix_length, items, items_length);
    *written = prefix_length + items_length;
    return ESP_OK;
}

static esp_err_t append_u64(uint64_t value, uint8_t *items, size_t *items_length)
{
    uint8_t encoded[8];
    for (size_t index = 0; index < sizeof(encoded); index++) {
        encoded[sizeof(encoded) - 1 - index] = (uint8_t)(value >> (index * 8));
    }
    return append_rlp(encoded, sizeof(encoded), items, items_length);
}

typedef struct {
    uint64_t chain_id;
    const char *name;
    const char *symbol;
} chain_policy_t;

static const chain_policy_t chain_policies[] = {
    {10143, "Monad Testnet", "MON"},
    {11155111, "Ethereum Sepolia", "ETH"},
#if CONFIG_MELODY_ENABLE_MAINNET
    {1, "Ethereum Mainnet", "ETH"},
    {8453, "Base", "ETH"},
    {42161, "Arbitrum One", "ETH"},
    {137, "Polygon", "POL"},
#endif
};

static const chain_policy_t *find_chain(uint64_t chain_id)
{
    for (size_t index = 0; index < sizeof(chain_policies) / sizeof(chain_policies[0]); index++) {
        if (chain_policies[index].chain_id == chain_id) return &chain_policies[index];
    }
    return NULL;
}

bool evm_chain_is_allowed(uint64_t chain_id)
{
    return find_chain(chain_id) != NULL;
}

const char *evm_chain_name(uint64_t chain_id)
{
    const chain_policy_t *policy = find_chain(chain_id);
    return policy ? policy->name : NULL;
}

const char *evm_chain_symbol(uint64_t chain_id)
{
    const chain_policy_t *policy = find_chain(chain_id);
    return policy ? policy->symbol : NULL;
}

esp_err_t evm_validate_native_transfer(const evm_native_transfer_t *transfer)
{
    if (transfer == NULL) return ESP_ERR_INVALID_ARG;
    if (!evm_chain_is_allowed(transfer->chain_id)) return ESP_ERR_NOT_SUPPORTED;
    if (transfer->gas_limit == 0 || transfer->gas_limit > 30000) return ESP_ERR_INVALID_SIZE;
    if (transfer->data_length != 0) return ESP_ERR_NOT_SUPPORTED;
    if (memcmp(transfer->max_priority_fee_per_gas, transfer->max_fee_per_gas, sizeof(transfer->max_fee_per_gas)) > 0) {
        return ESP_ERR_INVALID_ARG;
    }
    return ESP_OK;
}

void evm_register_signer(evm_signer_fn signer)
{
    registered_signer = signer;
}

evm_signer_fn evm_current_signer(void)
{
    return registered_signer;
}

esp_err_t evm_encode_eip1559_signing_payload(const evm_native_transfer_t *transfer,
                                             uint8_t *payload, size_t capacity,
                                             size_t *payload_length)
{
    uint8_t fields[EVM_MAX_RLP];
    size_t fields_length = 0;
    if (payload_length != NULL) *payload_length = 0;
    if (transfer == NULL || payload == NULL || payload_length == NULL) return ESP_ERR_INVALID_ARG;
    esp_err_t result = evm_validate_native_transfer(transfer);
    if (result != ESP_OK) return result;
    result = append_u64(transfer->chain_id, fields, &fields_length);
    if (result == ESP_OK) result = append_u64(transfer->nonce, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(transfer->max_priority_fee_per_gas, 32, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(transfer->max_fee_per_gas, 32, fields, &fields_length);
    if (result == ESP_OK) result = append_u64(transfer->gas_limit, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(transfer->recipient, sizeof(transfer->recipient), fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(transfer->value, sizeof(transfer->value), fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(NULL, 0, fields, &fields_length);
    if (result == ESP_OK) result = append_empty_list(fields, &fields_length);
    if (result != ESP_OK) return result;
    uint8_t encoded[2 + EVM_MAX_RLP];
    size_t encoded_length = 0;
    result = encode_list(fields, fields_length, encoded, sizeof(encoded), &encoded_length);
    if (result != ESP_OK || capacity < encoded_length + 1) return result == ESP_OK ? ESP_ERR_INVALID_SIZE : result;
    payload[0] = 0x02;
    memcpy(payload + 1, encoded, encoded_length);
    *payload_length = encoded_length + 1;
    return ESP_OK;
}

esp_err_t evm_sign_eip1559(const evm_native_transfer_t *transfer, uint8_t *signed_transaction,
                           size_t capacity, size_t *signed_length)
{
    if (signed_length != NULL) *signed_length = 0;
    if (signed_transaction == NULL || signed_length == NULL || registered_signer == NULL) return ESP_ERR_INVALID_STATE;
    esp_err_t validation = evm_validate_native_transfer(transfer);
    if (validation != ESP_OK) return validation;

    uint8_t payload[1 + EVM_MAX_RLP];
    size_t payload_length = 0;
    esp_err_t result = evm_encode_eip1559_signing_payload(transfer, payload, sizeof(payload), &payload_length);
    if (result != ESP_OK) return result;
    uint8_t digest[32];
    evm_keccak256(payload, payload_length, digest);
    uint8_t signature[65];
    result = registered_signer(digest, signature, sizeof(signature));
    if (result != ESP_OK || signature[64] > 1) return result == ESP_OK ? ESP_ERR_INVALID_RESPONSE : result;

    uint8_t fields[EVM_MAX_RLP];
    size_t fields_length = 0;
    result = append_u64(transfer->chain_id, fields, &fields_length);
    if (result == ESP_OK) result = append_u64(transfer->nonce, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(transfer->max_priority_fee_per_gas, 32, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(transfer->max_fee_per_gas, 32, fields, &fields_length);
    if (result == ESP_OK) result = append_u64(transfer->gas_limit, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(transfer->recipient, 20, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(transfer->value, 32, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(NULL, 0, fields, &fields_length);
    if (result == ESP_OK) result = append_empty_list(fields, &fields_length);
    if (result == ESP_OK) result = append_u64(signature[64], fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(signature, 32, fields, &fields_length);
    if (result == ESP_OK) result = append_rlp(signature + 32, 32, fields, &fields_length);
    uint8_t encoded[2 + EVM_MAX_RLP];
    size_t encoded_length = 0;
    if (result == ESP_OK) result = encode_list(fields, fields_length, encoded, sizeof(encoded), &encoded_length);
    if (result != ESP_OK || capacity < encoded_length + 1) return result == ESP_OK ? ESP_ERR_INVALID_SIZE : result;
    signed_transaction[0] = 0x02;
    memcpy(signed_transaction + 1, encoded, encoded_length);
    *signed_length = encoded_length + 1;
    return ESP_OK;
}
