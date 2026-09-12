#include "device_api.h"

#include "cJSON.h"
#include "display.h"
#include "evm_tx.h"
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
#include <string.h>

#define DEVICE_API_VERSION 1
#define DEVICE_API_CHAIN_KEY "active_chain_id"

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
    cJSON_AddBoolToObject(result, "address_derivation", false);
    cJSON_AddBoolToObject(result, "signing", false);
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

    char request_text[1024] = {0};
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
    } else if (strcmp(op, "wallet.configure") == 0) {
        const cJSON *chain = params ? cJSON_GetObjectItemCaseSensitive(params, "chain_id") : NULL;
        if (!cJSON_IsNumber(chain) || !evm_chain_is_allowed((uint64_t)chain->valuedouble)) {
            error = "unsupported or missing chain_id";
        } else {
            operation_result = set_active_chain_id((uint64_t)chain->valuedouble);
            result = cJSON_CreateObject();
            cJSON_AddNumberToObject(result, "active_chain_id", chain->valuedouble);
        }
    } else if (strcmp(op, "wallet.sign") == 0 || strcmp(op, "wallet.address") == 0) {
        error = "hardware signing/address derivation is not available";
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
