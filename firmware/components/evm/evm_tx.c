#include "evm_tx.h"

#include <string.h>

typedef struct {
    uint64_t chain_id;
    const char *name;
    const char *symbol;
} chain_policy_t;

static const chain_policy_t chain_policies[] = {
    {10143, "Monad Testnet", "MON"},
    {11155111, "Ethereum Sepolia", "ETH"},
    {1, "Ethereum Mainnet", "ETH"},
    {8453, "Base", "ETH"},
    {42161, "Arbitrum One", "ETH"},
    {137, "Polygon", "POL"},
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
    return ESP_OK;
}

esp_err_t evm_sign_eip1559(const evm_native_transfer_t *transfer, uint8_t *signed_transaction,
                           size_t capacity, size_t *signed_length)
{
    (void)signed_transaction;
    (void)capacity;
    if (signed_length != NULL) *signed_length = 0;
    esp_err_t validation = evm_validate_native_transfer(transfer);
    if (validation != ESP_OK) return validation;

    // Fail closed until a reviewed Keccak/secp256k1 or secure-element backend
    // is linked. Never emit an unsigned or pseudo-signed transaction.
    return ESP_ERR_NOT_SUPPORTED;
}
