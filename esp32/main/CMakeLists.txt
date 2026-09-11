idf_component_register(
    SRCS "main.c" "hardware.c" "display.c" "keystore.c" "wallet_state.c"
    INCLUDE_DIRS "."
    REQUIRES driver esp_timer esp_system nvs_flash protocol
)
