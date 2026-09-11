#include "keystore.h"

#include "nvs.h"
#include "nvs_flash.h"
#include "esp_random.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "keystore";
static uint8_t development_key[32];
static bool key_loaded;

esp_err_t keystore_init(void)
{
    nvs_handle_t handle;
    esp_err_t result = nvs_open("wallet", NVS_READWRITE, &handle);
    if (result != ESP_OK) return result;

    size_t key_size = sizeof(development_key);
    result = nvs_get_blob(handle, "dev_key", development_key, &key_size);
    if (result == ESP_ERR_NVS_NOT_FOUND) {
        esp_fill_random(development_key, sizeof(development_key));
        result = nvs_set_blob(handle, "dev_key", development_key, sizeof(development_key));
        if (result == ESP_OK) result = nvs_commit(handle);
    }
    nvs_close(handle);

    if (result == ESP_OK && key_size == sizeof(development_key)) {
        key_loaded = true;
        ESP_LOGW(TAG, "development key backend active; unsafe for real funds");
    }
    return result;
}

esp_err_t keystore_sign_digest(const uint8_t digest[32], uint8_t signature[65], size_t signature_capacity)
{
    (void)digest;
    (void)signature;
    (void)signature_capacity;
    if (!key_loaded) return ESP_ERR_INVALID_STATE;
    // Never substitute a software signature implementation here. This remains
    // fail-closed until a validated secp256k1 backend or secure element is wired.
    return ESP_ERR_NOT_SUPPORTED;
}

bool keystore_is_development_backend(void)
{
    return true;
}
