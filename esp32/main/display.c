#include "display.h"
#include "hardware.h"

#include "driver/i2c_master.h"
#include "esp_log.h"

static const char *TAG = "display";
static i2c_master_bus_handle_t display_bus;
static i2c_master_dev_handle_t display_device;
static bool display_connected;

static esp_err_t send_command(uint8_t command)
{
    const uint8_t packet[] = {0x00, command};
    return i2c_master_transmit(display_device, packet, sizeof(packet), 100);
}

static esp_err_t draw_test_pattern(void)
{
    uint8_t data[129] = {0x40};
    for (uint8_t page = 0; page < 8; page++) {
        if (send_command((uint8_t)(0xb0 | page)) != ESP_OK) return ESP_FAIL;
        if (send_command(0x00) != ESP_OK || send_command(0x10) != ESP_OK) return ESP_FAIL;
        for (size_t index = 1; index < sizeof(data); index++) data[index] = (page % 2 == 0) ? 0xaa : 0x55;
        if (i2c_master_transmit(display_device, data, sizeof(data), 100) != ESP_OK) return ESP_FAIL;
    }
    return ESP_OK;
}

esp_err_t display_init(void)
{
    const i2c_master_bus_config_t bus_config = {
        .i2c_port = I2C_NUM_0,
        .sda_io_num = MELODY_OLED_SDA_GPIO,
        .scl_io_num = MELODY_OLED_SCL_GPIO,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    esp_err_t result = i2c_new_master_bus(&bus_config, &display_bus);
    if (result != ESP_OK) {
        ESP_LOGW(TAG, "I2C bus init failed: %s", esp_err_to_name(result));
        return ESP_OK;
    }

    uint8_t address = 0;
    if (i2c_master_probe(display_bus, 0x3c, 100) == ESP_OK) address = 0x3c;
    if (address == 0 && i2c_master_probe(display_bus, 0x3d, 100) == ESP_OK) address = 0x3d;
    if (address == 0) {
        ESP_LOGW(TAG, "SSD1306 not detected at 0x3c or 0x3d");
        return ESP_OK;
    }

    const i2c_device_config_t device_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = address,
        .scl_speed_hz = 400000,
    };
    result = i2c_master_bus_add_device(display_bus, &device_config, &display_device);
    if (result != ESP_OK) {
        ESP_LOGW(TAG, "SSD1306 device setup failed: %s", esp_err_to_name(result));
        return ESP_OK;
    }

    const uint8_t init_commands[] = {
        0xae, 0xd5, 0x80, 0xa8, 0x3f, 0xd3, 0x00, 0x40, 0x8d, 0x14,
        0x20, 0x00, 0xa1, 0xc8, 0xda, 0x12, 0x81, 0x8f, 0xd9, 0xf1,
        0xdb, 0x40, 0xa4, 0xa6, 0xaf,
    };
    for (size_t index = 0; index < sizeof(init_commands); index++) {
        if (send_command(init_commands[index]) != ESP_OK) {
            ESP_LOGW(TAG, "SSD1306 init command failed");
            return ESP_OK;
        }
    }

    display_connected = true;
    ESP_LOGI(TAG, "SSD1306 detected at 0x%02x", address);
    if (draw_test_pattern() != ESP_OK) ESP_LOGW(TAG, "SSD1306 test pattern failed");
    return ESP_OK;
}

bool display_is_connected(void)
{
    return display_connected;
}

void display_message(const char *line1, const char *line2, const char *line3, const char *line4)
{
    ESP_LOGI(TAG, "%s | %s | %s | %s", line1 ? line1 : "", line2 ? line2 : "", line3 ? line3 : "", line4 ? line4 : "");
}
