idf_component_register(
    SRCS "main.c" "hardware.c" "display.c" "keystore.c" "wallet_state.c" "device_api.c" "button.c"
    INCLUDE_DIRS "."
    REQUIRES console driver esp_driver_i2c esp_timer esp_system nvs_flash protocol ggwave json evm eip3009 mbedtls
)
