#include "device_api.h"

#include "cJSON.h"
#include "button.h"
#include "display.h"
#include "evm_tx.h"
#include "evm_self_test.h"
#include "ggwave_transport.h"
#include "hardware.h"
#include "keystore.h"
#include "wallet_state.h"

#include "esp_chip_info.h"
#include "esp_system.h"
#include "nvs.h"
#include "nvs_flash.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#define DEVICE_API_VERSION 1
#define DEVICE_API_CHAIN_KEY "active_chain_id"
#define DEVICE_API_MAINNET_KEY "allow_mainnet"

static bool signing_in_progress;

static void send_response(int id, bool ok, cJSON *result, const char *error)
{
    cJSON *response = cJSON_CreateObject();
    cJSON_AddNumberToObject(response, "id", id);
    cJSON_AddBoolToObject(response, "ok", ok);
    if (ok) {
        cJSON_AddItemToObject(response, "result", result != NULL ? result : cJSON_CreateObject());
    } else {
        cJSON_AddStringToObject(response, "error", error != NULL ? error : "unknown error");
        cJSON_Delete(result);
    }

    char *serialized = cJSON_PrintUnformatted(response);
    if (serialized != NULL) {
        printf("%s\n", serialized);
        free(serialized);
    }
    cJSON_Delete(response);
}

static uint64_t active_chain_id(void)
{
    nvs_handle_t handle;
    uint64_t chain_id = 0;
    if (nvs_open("wallet", NVS_READONLY, &handle) == ESP_OK) {
        (void)nvs_get_u64(handle, DEVICE_API_CHAIN_KEY, &chain_id);
        nvs_close(handle);
    }
    return chain_id;
}

static esp_err_t set_active_chain_id(uint64_t chain_id)
{
    nvs_handle_t handle;
    esp_err_t result = nvs_open("wallet", NVS_READWRITE, &handle);
    if (result != ESP_OK) return result;
    result = nvs_set_u64(handle, DEVICE_API_CHAIN_KEY, chain_id);
    if (result == ESP_OK) result = nvs_commit(handle);
    nvs_close(handle);
    return result;
}

static esp_err_t parse_chain_number(const cJSON *item, uint64_t *chain_id)
{
    if (!cJSON_IsNumber(item) || !isfinite(item->valuedouble) || item->valuedouble < 0 ||
        floor(item->valuedouble) != item->valuedouble || item->valuedouble > 9007199254740991.0) {
        return ESP_ERR_INVALID_ARG;
    }
    const uint64_t parsed = (uint64_t)item->valuedouble;
    if ((double)parsed != item->valuedouble) return ESP_ERR_INVALID_ARG;
    *chain_id = parsed;
    return ESP_OK;
}

static bool runtime_mainnet_opt_in(void)
{
    nvs_handle_t handle;
    uint8_t enabled = 0;
    if (nvs_open("wallet", NVS_READONLY, &handle) == ESP_OK) {
        (void)nvs_get_u8(handle, DEVICE_API_MAINNET_KEY, &enabled);
        nvs_close(handle);
    }
    return enabled != 0;
}

 #if CONFIG_MELODY_ENABLE_MAINNET
static esp_err_t set_mainnet_opt_in(bool enabled)
{
    nvs_handle_t handle;
    esp_err_t result = nvs_open("wallet", NVS_READWRITE, &handle);
    if (result != ESP_OK) return result;
    result = nvs_set_u8(handle, DEVICE_API_MAINNET_KEY, enabled ? 1 : 0);
    if (result == ESP_OK) result = nvs_commit(handle);
    nvs_close(handle);
    return result;
}
 #endif

static void bytes_to_hex(const uint8_t *bytes, size_t length, char *output)
{
    static const char hex[] = "0123456789abcdef";
    for (size_t index = 0; index < length; index++) {
        output[index * 2] = hex[bytes[index] >> 4];
        output[index * 2 + 1] = hex[bytes[index] & 0x0f];
    }
    output[length * 2] = '\0';
}

static int hex_value(char character)
{
    if (character >= '0' && character <= '9') return character - '0';
    if (character >= 'a' && character <= 'f') return character - 'a' + 10;
    if (character >= 'A' && character <= 'F') return character - 'A' + 10;
    return -1;
}

static esp_err_t parse_hex(const cJSON *item, uint8_t *output, size_t output_length)
{
    if (!cJSON_IsString(item) || item->valuestring == NULL) return ESP_ERR_INVALID_ARG;
    const char *text = item->valuestring;
    if (text[0] == '0' && (text[1] == 'x' || text[1] == 'X')) text += 2;
    const size_t text_length = strlen(text);
    if (text_length != output_length * 2) return ESP_ERR_INVALID_SIZE;
    for (size_t index = 0; index < output_length; index++) {
        const int high = hex_value(text[index * 2]);
        const int low = hex_value(text[index * 2 + 1]);
        if (high < 0 || low < 0) return ESP_ERR_INVALID_ARG;
        output[index] = (uint8_t)((high << 4) | low);
    }
    return ESP_OK;
}

static esp_err_t parse_u64_hex(const cJSON *item, uint64_t *value)
{
    if (!cJSON_IsString(item) || item->valuestring == NULL) return ESP_ERR_INVALID_ARG;
    const char *text = item->valuestring;
    if (text[0] != '0' || (text[1] != 'x' && text[1] != 'X')) return ESP_ERR_INVALID_ARG;
    text += 2;
    const size_t length = strlen(text);
    if (length == 0 || length > 16) return ESP_ERR_INVALID_SIZE;
    uint64_t parsed = 0;
    for (size_t index = 0; index < length; index++) {
        const int digit = hex_value(text[index]);
        if (digit < 0) return ESP_ERR_INVALID_ARG;
        parsed = (parsed << 4) | (uint64_t)digit;
    }
    *value = parsed;
    return ESP_OK;
}

static esp_err_t sign_request(const cJSON *params, cJSON **result)
{
    if (!cJSON_IsObject(params)) return ESP_ERR_INVALID_ARG;
    evm_native_transfer_t transfer = {0};
    esp_err_t error = parse_u64_hex(cJSON_GetObjectItemCaseSensitive(params, "chain_id"), &transfer.chain_id);
    if (error == ESP_OK) error = parse_u64_hex(cJSON_GetObjectItemCaseSensitive(params, "nonce"), &transfer.nonce);
    uint64_t gas_limit = 0;
    if (error == ESP_OK) error = parse_u64_hex(cJSON_GetObjectItemCaseSensitive(params, "gas_limit"), &gas_limit);
    if (error == ESP_OK && (gas_limit == 0 || gas_limit > UINT32_MAX)) error = ESP_ERR_INVALID_SIZE;
    if (error == ESP_OK) transfer.gas_limit = (uint32_t)gas_limit;
    if (error == ESP_OK) error = parse_hex(cJSON_GetObjectItemCaseSensitive(params, "to"), transfer.recipient, 20);
    if (error == ESP_OK) error = parse_hex(cJSON_GetObjectItemCaseSensitive(params, "value"), transfer.value, 32);
    if (error == ESP_OK) error = parse_hex(cJSON_GetObjectItemCaseSensitive(params, "max_priority_fee_per_gas"), transfer.max_priority_fee_per_gas, 32);
    if (error == ESP_OK) error = parse_hex(cJSON_GetObjectItemCaseSensitive(params, "max_fee_per_gas"), transfer.max_fee_per_gas, 32);
    const cJSON *data = cJSON_GetObjectItemCaseSensitive(params, "data");
    if (error == ESP_OK && (!cJSON_IsString(data) || strcmp(data->valuestring, "0x") != 0)) error = ESP_ERR_NOT_SUPPORTED;
    if (error != ESP_OK) return error;
    if (transfer.chain_id != active_chain_id()) return ESP_ERR_INVALID_STATE;
    if (transfer.chain_id == 1 && !runtime_mainnet_opt_in()) return ESP_ERR_INVALID_STATE;
    error = evm_validate_native_transfer(&transfer);
    if (error != ESP_OK) return error;
    const cJSON *timeout = cJSON_GetObjectItemCaseSensitive(params, "timeout_seconds");
    const int timeout_seconds = cJSON_IsNumber(timeout) ? timeout->valueint : 15;
    if (timeout_seconds <= 0 || timeout_seconds > 60) return ESP_ERR_INVALID_ARG;
    if (signing_in_progress) return ESP_ERR_INVALID_STATE;
    signing_in_progress = true;
    wallet_state_set(WALLET_REVIEW);
    char recipient_preview[32];
    snprintf(recipient_preview, sizeof(recipient_preview), "0x%02x%02x%02x%02x...",
             transfer.recipient[0], transfer.recipient[1], transfer.recipient[2], transfer.recipient[3]);
    display_message(evm_chain_name(transfer.chain_id), recipient_preview, "Native transfer", "");
    error = button_wait_for_approval((uint32_t)timeout_seconds * 1000);
    if (error != ESP_OK) {
        signing_in_progress = false;
        wallet_state_set(WALLET_IDLE);
        return error;
    }
    wallet_state_set(WALLET_APPROVED);
    uint8_t signed_transaction[256];
    size_t signed_length = 0;
    error = evm_sign_eip1559(&transfer, signed_transaction, sizeof(signed_transaction), &signed_length);
    if (error != ESP_OK) {
        memset(signed_transaction, 0, sizeof(signed_transaction));
        signing_in_progress = false;
        wallet_state_set(WALLET_IDLE);
        return error;
    }
    char transaction_hex[513];
    bytes_to_hex(signed_transaction, signed_length, transaction_hex);
    *result = cJSON_CreateObject();
    cJSON_AddStringToObject(*result, "raw_transaction", transaction_hex);
    display_message("PAYMENT", "Complete", "Transaction signed", "");
    (void)hardware_play_success_chime();
    memset(signed_transaction, 0, sizeof(signed_transaction));
    signing_in_progress = false;
    wallet_state_set(WALLET_IDLE);
    return ESP_OK;
}

static cJSON *device_info(void)
{
    esp_chip_info_t chip;
    esp_chip_info(&chip);
    cJSON *result = cJSON_CreateObject();
    cJSON_AddNumberToObject(result, "api_version", DEVICE_API_VERSION);
    cJSON_AddStringToObject(result, "firmware", esp_get_idf_version());
    cJSON_AddStringToObject(result, "chip", "ESP32-S3");
    cJSON_AddNumberToObject(result, "cores", chip.cores);
    cJSON_AddBoolToObject(result, "audio", true);
    cJSON_AddBoolToObject(result, "display", display_is_connected());
    return result;
}

static cJSON *device_status(void)
{
    cJSON *result = cJSON_CreateObject();
    cJSON_AddNumberToObject(result, "wallet_state", wallet_state_get());
    cJSON_AddNumberToObject(result, "active_chain_id", (double)active_chain_id());
    cJSON_AddBoolToObject(result, "display_connected", display_is_connected());
    cJSON_AddBoolToObject(result, "audio_available", true);
    cJSON_AddBoolToObject(result, "address_derivation", keystore_is_ready());
    cJSON_AddBoolToObject(result, "signing", keystore_is_ready());
    cJSON_AddBoolToObject(result, "private_key_export", false);
    cJSON_AddBoolToObject(result, "development_key_backend", keystore_is_development_backend());
    return result;
}

int device_api_command(int argc, char **argv)
{
    if (argc < 2) {
        printf("{\"id\":0,\"ok\":false,\"error\":\"missing JSON request\"}\n");
        return 1;
    }

    char request_text[2048] = {0};
    size_t length = 0;
    for (int index = 1; index < argc; index++) {
        if (index > 1 && length + 1 < sizeof(request_text)) request_text[length++] = ' ';
        const size_t part_length = strlen(argv[index]);
        if (length + part_length >= sizeof(request_text)) {
            printf("{\"id\":0,\"ok\":false,\"error\":\"request too large\"}\n");
            return 1;
        }
        memcpy(request_text + length, argv[index], part_length);
        length += part_length;
    }

    cJSON *request = cJSON_Parse(request_text);
    if (request == NULL) {
        printf("{\"id\":0,\"ok\":false,\"error\":\"invalid JSON\"}\n");
        return 1;
    }

    const cJSON *id_item = cJSON_GetObjectItemCaseSensitive(request, "id");
    const cJSON *op_item = cJSON_GetObjectItemCaseSensitive(request, "op");
    const cJSON *params = cJSON_GetObjectItemCaseSensitive(request, "params");
    const int id = cJSON_IsNumber(id_item) ? id_item->valueint : 0;
    const char *op = cJSON_IsString(op_item) ? op_item->valuestring : NULL;
    cJSON *result = NULL;
    const char *error = NULL;
    esp_err_t operation_result = ESP_OK;

    if (op == NULL) {
        error = "missing operation";
    } else if (strcmp(op, "device.info") == 0) {
        result = device_info();
    } else if (strcmp(op, "device.status") == 0) {
        result = device_status();
    } else if (strcmp(op, "wallet.capabilities") == 0) {
        result = device_status();
    } else if (strcmp(op, "display.text") == 0) {
        const cJSON *text = params ? cJSON_GetObjectItemCaseSensitive(params, "text") : NULL;
        if (!cJSON_IsString(text)) {
            error = "text is required";
        } else {
            operation_result = display_text(text->valuestring);
            result = cJSON_CreateObject();
        }
    } else if (strcmp(op, "audio.self_test") == 0) {
        operation_result = hardware_run_audio_self_test();
        result = cJSON_CreateObject();
    } else if (strcmp(op, "ggwave.self_test") == 0) {
        const int test_result = ggwave_transport_self_test();
        if (test_result != 0) operation_result = ESP_FAIL;
        result = cJSON_CreateObject();
        cJSON_AddNumberToObject(result, "result", test_result);
    } else if (strcmp(op, "wallet.crypto_self_test") == 0 || strcmp(op, "crypto_self_test") == 0) {
        operation_result = keystore_crypto_self_test();
        result = cJSON_CreateObject();
        cJSON_AddStringToObject(result, "status", operation_result == ESP_OK ? "passed" : "failed");
    } else if (strcmp(op, "wallet.configure") == 0) {
        const cJSON *chain = params ? cJSON_GetObjectItemCaseSensitive(params, "chain_id") : NULL;
        uint64_t requested_chain = 0;
        if (parse_chain_number(chain, &requested_chain) != ESP_OK || !evm_chain_is_allowed(requested_chain)) {
            error = "unsupported or missing chain_id";
        } else if (requested_chain == 1) {
#if CONFIG_MELODY_ENABLE_MAINNET
            const cJSON *allow = params ? cJSON_GetObjectItemCaseSensitive(params, "allow_mainnet") : NULL;
            if (!cJSON_IsTrue(allow)) {
                error = "mainnet requires allow_mainnet=true";
            } else {
                operation_result = set_mainnet_opt_in(true);
                if (operation_result == ESP_OK) operation_result = set_active_chain_id(requested_chain);
                result = cJSON_CreateObject();
                cJSON_AddNumberToObject(result, "active_chain_id", (double)requested_chain);
                cJSON_AddStringToObject(result, "name", evm_chain_name(requested_chain));
                cJSON_AddStringToObject(result, "symbol", evm_chain_symbol(requested_chain));
                cJSON_AddStringToObject(result, "warning", "mainnet enabled for development backend");
            }
#else
            error = "mainnet disabled by build configuration";
#endif
        } else {
            operation_result = set_active_chain_id(requested_chain);
            result = cJSON_CreateObject();
            cJSON_AddNumberToObject(result, "active_chain_id", (double)requested_chain);
            cJSON_AddStringToObject(result, "name", evm_chain_name(requested_chain));
            cJSON_AddStringToObject(result, "symbol", evm_chain_symbol(requested_chain));
        }
    } else if (strcmp(op, "wallet.wait_approval") == 0) {
        const cJSON *timeout = params ? cJSON_GetObjectItemCaseSensitive(params, "timeout_seconds") : NULL;
        const int timeout_seconds = cJSON_IsNumber(timeout) ? timeout->valueint : 15;
        if (timeout_seconds <= 0 || timeout_seconds > 60) {
            error = "timeout_seconds must be between 1 and 60";
        } else {
            operation_result = button_wait_for_approval((uint32_t)timeout_seconds * 1000);
            result = cJSON_CreateObject();
            cJSON_AddStringToObject(result, "decision", operation_result == ESP_OK ? "approved" : "timeout");
            if (operation_result == ESP_ERR_TIMEOUT) operation_result = ESP_OK;
        }
    } else if (strcmp(op, "wallet.address") == 0) {
        uint8_t address[20];
        char address_hex[43];
        operation_result = keystore_get_address(address);
        if (operation_result == ESP_OK) {
            address_hex[0] = '0';
            address_hex[1] = 'x';
            bytes_to_hex(address, sizeof(address), address_hex + 2);
            result = cJSON_CreateObject();
            cJSON_AddStringToObject(result, "address", address_hex);
        }
    } else if (strcmp(op, "wallet.sign") == 0) {
        operation_result = sign_request(params, &result);
    } else {
        error = "unknown operation";
    }

    cJSON_Delete(request);
    if (error != NULL) {
        send_response(id, false, NULL, error);
        return 1;
    }
    if (operation_result != ESP_OK) {
        send_response(id, false, result, esp_err_to_name(operation_result));
        return 1;
    }
    send_response(id, true, result, NULL);
    return 0;
}
