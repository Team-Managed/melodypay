#include "display.h"
#include "oled_animation.h"
#include "oled_qr.h"
#include "oled_success_warp.h"
#include "oled_success_check.h"
#include "hardware.h"

#include "driver/i2c_master.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <ctype.h>
#include <stdio.h>
#include <string.h>

static const char *TAG = "display";
static i2c_master_bus_handle_t display_bus;
static i2c_master_dev_handle_t display_device;
static bool display_connected;
static uint8_t display_buffer[8 * 128];

static const uint8_t letter_glyphs[26][5] = {
    {0x7e, 0x11, 0x11, 0x7e, 0x00}, {0x7f, 0x49, 0x49, 0x36, 0x00},
    {0x3e, 0x41, 0x41, 0x22, 0x00}, {0x7f, 0x41, 0x41, 0x3e, 0x00},
    {0x7f, 0x49, 0x49, 0x41, 0x00}, {0x7f, 0x09, 0x09, 0x01, 0x00},
    {0x3e, 0x41, 0x49, 0x7a, 0x00}, {0x7f, 0x08, 0x08, 0x7f, 0x00},
    {0x41, 0x7f, 0x41, 0x00, 0x00}, {0x20, 0x40, 0x41, 0x3f, 0x00},
    {0x7f, 0x08, 0x14, 0x63, 0x00}, {0x7f, 0x40, 0x40, 0x00, 0x00},
    {0x7f, 0x06, 0x18, 0x06, 0x7f}, {0x7f, 0x06, 0x18, 0x7f, 0x00},
    {0x3e, 0x41, 0x41, 0x3e, 0x00}, {0x7f, 0x09, 0x09, 0x06, 0x00},
    {0x3e, 0x41, 0x61, 0x7e, 0x00}, {0x7f, 0x09, 0x19, 0x66, 0x00},
    {0x46, 0x49, 0x49, 0x31, 0x00}, {0x01, 0x7f, 0x01, 0x00, 0x00},
    {0x3f, 0x40, 0x40, 0x3f, 0x00}, {0x1f, 0x60, 0x60, 0x1f, 0x00},
    {0x7f, 0x30, 0x0c, 0x30, 0x7f}, {0x63, 0x1c, 0x1c, 0x63, 0x00},
    {0x07, 0x78, 0x07, 0x00, 0x00}, {0x61, 0x51, 0x49, 0x47, 0x00},
};

static const uint8_t digit_glyphs[10][5] = {
    {0x3e, 0x41, 0x41, 0x3e, 0x00}, {0x42, 0x7f, 0x40, 0x00, 0x00},
    {0x62, 0x51, 0x49, 0x46, 0x00}, {0x22, 0x49, 0x49, 0x36, 0x00},
    {0x18, 0x14, 0x12, 0x7f, 0x00}, {0x2f, 0x49, 0x49, 0x31, 0x00},
    {0x3e, 0x49, 0x49, 0x30, 0x00}, {0x01, 0x71, 0x09, 0x07, 0x00},
    {0x36, 0x49, 0x49, 0x36, 0x00}, {0x06, 0x49, 0x49, 0x3e, 0x00},
};

static const uint8_t small_letter_glyphs[26][5] = {
    {0x02, 0x05, 0x07, 0x05, 0x05}, {0x06, 0x05, 0x06, 0x05, 0x06},
    {0x03, 0x04, 0x04, 0x04, 0x03}, {0x06, 0x05, 0x05, 0x05, 0x06},
    {0x07, 0x04, 0x06, 0x04, 0x07}, {0x07, 0x04, 0x06, 0x04, 0x04},
    {0x03, 0x04, 0x05, 0x05, 0x03}, {0x05, 0x05, 0x07, 0x05, 0x05},
    {0x07, 0x02, 0x02, 0x02, 0x07}, {0x01, 0x01, 0x01, 0x05, 0x02},
    {0x05, 0x05, 0x06, 0x05, 0x05}, {0x04, 0x04, 0x04, 0x04, 0x07},
    {0x05, 0x07, 0x07, 0x05, 0x05}, {0x06, 0x05, 0x05, 0x05, 0x05},
    {0x02, 0x05, 0x05, 0x05, 0x02}, {0x06, 0x05, 0x06, 0x04, 0x04},
    {0x03, 0x04, 0x05, 0x05, 0x03}, {0x06, 0x05, 0x06, 0x05, 0x05},
    {0x03, 0x04, 0x02, 0x01, 0x06}, {0x07, 0x02, 0x02, 0x02, 0x02},
    {0x05, 0x05, 0x05, 0x05, 0x02}, {0x05, 0x05, 0x05, 0x05, 0x02},
    {0x05, 0x05, 0x07, 0x07, 0x05}, {0x05, 0x05, 0x02, 0x05, 0x05},
    {0x05, 0x05, 0x02, 0x02, 0x02}, {0x07, 0x01, 0x02, 0x04, 0x07},
};

static const uint8_t small_digit_glyphs[10][5] = {
    {0x07, 0x05, 0x05, 0x05, 0x07}, {0x02, 0x06, 0x02, 0x02, 0x07},
    {0x06, 0x01, 0x02, 0x04, 0x07}, {0x06, 0x01, 0x02, 0x01, 0x06},
    {0x05, 0x05, 0x07, 0x01, 0x01}, {0x07, 0x04, 0x06, 0x01, 0x06},
    {0x03, 0x04, 0x06, 0x05, 0x02}, {0x07, 0x01, 0x02, 0x02, 0x02},
    {0x02, 0x05, 0x02, 0x05, 0x02}, {0x02, 0x05, 0x03, 0x01, 0x06},
};

static const uint8_t *glyph_for_char(char character)
{
    static const uint8_t blank[5] = {0, 0, 0, 0, 0};
    static const uint8_t punctuation[][5] = {
        {0x00, 0x00, 0x5f, 0x00, 0x00}, // !
        {0x00, 0x40, 0x00, 0x00, 0x00}, // .
        {0x00, 0x20, 0x40, 0x00, 0x00}, // ,
        {0x08, 0x08, 0x08, 0x00, 0x00}, // -
        {0x40, 0x40, 0x40, 0x40, 0x40}, // _
        {0x60, 0x18, 0x06, 0x01, 0x00}, // /
        {0x02, 0x01, 0x51, 0x09, 0x06}, // ?
        {0x00, 0x36, 0x00, 0x00, 0x00}, // :
        {0x04, 0x0e, 0x1f, 0x0e, 0x04}, // *
    };

    character = (char)toupper((unsigned char)character);
    if (character >= 'A' && character <= 'Z') return letter_glyphs[character - 'A'];
    if (character >= '0' && character <= '9') return digit_glyphs[character - '0'];
    if (character == ' ') return blank;
    if (character == '!') return punctuation[0];
    if (character == '.') return punctuation[1];
    if (character == ',') return punctuation[2];
    if (character == '-') return punctuation[3];
    if (character == '_') return punctuation[4];
    if (character == '/') return punctuation[5];
    if (character == '?') return punctuation[6];
    if (character == ':') return punctuation[7];
    if (character == '*') return punctuation[8];
    return punctuation[6];
}

static const uint8_t *small_glyph_for_char(char character)
{
    static const uint8_t blank[5] = {0, 0, 0, 0, 0};
    static const uint8_t dot[5] = {0, 0, 0, 0, 0x02};
    static const uint8_t dash[5] = {0, 0x07, 0, 0, 0};
    static const uint8_t slash[5] = {0x01, 0x02, 0x02, 0x04, 0x04};

    character = (char)toupper((unsigned char)character);
    if (character >= 'A' && character <= 'Z') return small_letter_glyphs[character - 'A'];
    if (character >= '0' && character <= '9') return small_digit_glyphs[character - '0'];
    if (character == ' ') return blank;
    if (character == '.') return dot;
    if (character == '-') return dash;
    if (character == '/') return slash;
    return blank;
}

static esp_err_t send_command(uint8_t command)
{
    const uint8_t packet[] = {0x00, command};
    return i2c_master_transmit(display_device, packet, sizeof(packet), 100);
}

esp_err_t display_test_pattern(void)
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

static esp_err_t flush_display_buffer(void)
{
    uint8_t packet[129];
    packet[0] = 0x40;
    for (uint8_t page = 0; page < 8; page++) {
        if (send_command((uint8_t)(0xb0 | page)) != ESP_OK) return ESP_FAIL;
        if (send_command(0x00) != ESP_OK || send_command(0x10) != ESP_OK) return ESP_FAIL;
        memcpy(packet + 1, display_buffer + page * 128, 128);
        if (i2c_master_transmit(display_device, packet, sizeof(packet), 100) != ESP_OK) return ESP_FAIL;
    }
    return ESP_OK;
}

static void draw_line(const char *text, uint8_t line)
{
    if (text == NULL || line >= 4) return;
    const size_t page_offset = (size_t)line * 2 * 128;
    size_t text_length = 0;
    while (text[text_length] != '\0' && text[text_length] != '\n' && text_length < 21) text_length++;
    uint8_t column = (uint8_t)((21 - text_length) / 2);
    for (size_t index = 0; text[index] != '\0' && text[index] != '\n' && column < 21; index++) {
        const uint8_t *glyph = glyph_for_char(text[index]);
        for (uint8_t glyph_column = 0; glyph_column < 5; glyph_column++) {
            display_buffer[page_offset + column * 6 + glyph_column] = glyph[glyph_column];
        }
        column++;
    }
}

static void set_pixel(uint8_t x, uint8_t y, bool on)
{
    if (x >= 128 || y >= 64) return;
    const size_t index = (size_t)(y / 8) * 128 + x;
    if (on) display_buffer[index] |= (uint8_t)(1u << (y % 8));
    else display_buffer[index] &= (uint8_t)~(1u << (y % 8));
}

static void draw_box(uint8_t x, uint8_t y, uint8_t width, uint8_t height)
{
    for (uint8_t dx = 0; dx < width; dx++) {
        set_pixel((uint8_t)(x + dx), y, true);
        set_pixel((uint8_t)(x + dx), (uint8_t)(y + height - 1), true);
    }
    for (uint8_t dy = 0; dy < height; dy++) {
        set_pixel(x, (uint8_t)(y + dy), true);
        set_pixel((uint8_t)(x + width - 1), (uint8_t)(y + dy), true);
    }
}

static void draw_selection(uint8_t row)
{
    draw_box(27, (uint8_t)(row * 16 - 4), 74, 13);
}

static void draw_scroll_arrows(bool up, bool down)
{
    if (up) for (uint8_t i = 0; i < 5; i++) set_pixel((uint8_t)(124 + i / 2), (uint8_t)(3 + i), true);
    if (down) for (uint8_t i = 0; i < 5; i++) set_pixel((uint8_t)(124 + i / 2), (uint8_t)(58 - i), true);
}

esp_err_t display_text(const char *text)
{
    if (!display_connected || text == NULL) return ESP_ERR_NOT_SUPPORTED;
    memset(display_buffer, 0, sizeof(display_buffer));

    uint8_t line = 0;
    uint8_t column = 0;
    for (size_t index = 0; text[index] != '\0' && line < 4; index++) {
        if (text[index] == '\n' || column == 21) {
            line++;
            column = 0;
            if (text[index] == '\n') continue;
            if (line >= 4) break;
        }
        const uint8_t *glyph = glyph_for_char(text[index]);
        const size_t page_offset = (size_t)line * 2 * 128;
        for (uint8_t glyph_column = 0; glyph_column < 5; glyph_column++) {
            display_buffer[page_offset + column * 6 + glyph_column] = glyph[glyph_column];
        }
        column++;
    }
    return flush_display_buffer();
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
    if (display_test_pattern() != ESP_OK) ESP_LOGW(TAG, "SSD1306 test pattern failed");
    return ESP_OK;
}

bool display_is_connected(void)
{
    return display_connected;
}

void display_message(const char *line1, const char *line2, const char *line3, const char *line4)
{
    ESP_LOGI(TAG, "%s | %s | %s | %s", line1 ? line1 : "", line2 ? line2 : "", line3 ? line3 : "", line4 ? line4 : "");
    if (!display_connected) return;
    memset(display_buffer, 0, sizeof(display_buffer));
    draw_line(line1, 0);
    draw_line(line2, 1);
    draw_line(line3, 2);
    draw_line(line4, 3);
    if (flush_display_buffer() != ESP_OK) ESP_LOGW(TAG, "text render failed");
}

void display_boot_animation(void)
{
    if (!display_connected) return;
    for (uint8_t frame = 0; frame < OLED_ANIMATION_FRAME_COUNT; frame++) {
        memcpy(display_buffer, oled_animation_frames[frame], sizeof(display_buffer));
        (void)flush_display_buffer();
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void display_home_screen(uint8_t selection)
{
    memset(display_buffer, 0, sizeof(display_buffer));
    draw_line("MelodyPay", 0);
    draw_line("PAY", 1);
    draw_line("RECEIVE", 2);
    draw_line("MENU", 3);
    draw_selection((uint8_t)(selection + 1));
    (void)flush_display_buffer();
}

void display_menu_screen(uint8_t selection)
{
    static const char *labels[] = {"STATUS", "NETWORK", "REBOOT", "BACK"};
    memset(display_buffer, 0, sizeof(display_buffer));
    draw_line("MENU", 0);
    uint8_t first = selection > 1 ? 1 : 0;
    for (uint8_t row = 0; row < 3; row++) draw_line(labels[first + row], (uint8_t)(row + 1));
    draw_selection((uint8_t)(selection - first + 1));
    draw_scroll_arrows(first > 0, first + 3 < 4);
    (void)flush_display_buffer();
}

void display_payment_screen(void)
{
    display_message("PAYMENT", "Waiting request", "Audio link ready", "");
}

void display_payment_menu_screen(uint8_t selection)
{
    memset(display_buffer, 0, sizeof(display_buffer));
    draw_line("LISTENING FOR", 0);
    draw_line("PAYMENT", 1);
    draw_line("REPLAY", 2);
    draw_line("BACK", 3);
    draw_selection((uint8_t)(selection + 2));
    (void)flush_display_buffer();
}

void display_receive_screen(void)
{
    memcpy(display_buffer, oled_qr_frame, sizeof(display_buffer));
    (void)flush_display_buffer();
}

static void draw_small_line(const char *text, uint8_t y)
{
    if (text == NULL || y > 59) return;
    size_t length = strlen(text);
    if (length > 31) length = 31;
    const uint8_t x = (uint8_t)((128 - length * 4) / 2);
    for (size_t index = 0; index < length; index++) {
        const uint8_t *glyph = small_glyph_for_char(text[index]);
        for (uint8_t glyph_y = 0; glyph_y < 5; glyph_y++) {
            for (uint8_t glyph_x = 0; glyph_x < 3; glyph_x++) {
                if ((glyph[glyph_y] & (uint8_t)(1u << (2 - glyph_x))) != 0) {
                    set_pixel((uint8_t)(x + index * 4 + glyph_x), (uint8_t)(y + glyph_y), true);
                }
            }
        }
    }
}

static void draw_final_checkmark_top(void)
{
    const uint8_t *frame = OLED_SUCCESS_CHECK_frames[OLED_SUCCESS_CHECK_FRAME_COUNT - 1];
    for (uint8_t y = 24; y < 40; y++) {
        for (uint8_t x = 56; x < 72; x++) {
            const size_t source_index = (size_t)(y / 8) * 128 + x;
            if ((frame[source_index] & (uint8_t)(1u << (y % 8))) != 0) {
                set_pixel(x, (uint8_t)(y - 24), true);
            }
        }
    }
}

void display_success_warp_frame(uint8_t frame)
{
    if (!display_connected) return;
    if (frame >= OLED_SUCCESS_WARP_FRAME_COUNT) frame = OLED_SUCCESS_WARP_FRAME_COUNT - 1;
    memcpy(display_buffer, OLED_SUCCESS_WARP_frames[frame], sizeof(display_buffer));
    (void)flush_display_buffer();
}

void display_success_check_frame(uint8_t frame)
{
    if (!display_connected) return;
    if (frame >= OLED_SUCCESS_CHECK_FRAME_COUNT) frame = OLED_SUCCESS_CHECK_FRAME_COUNT - 1;
    memcpy(display_buffer, OLED_SUCCESS_CHECK_frames[frame], sizeof(display_buffer));
    (void)flush_display_buffer();
}

void display_success_warp_animation(void)
{
    if (!display_connected) return;
    for (uint8_t frame = 0; frame < OLED_SUCCESS_WARP_FRAME_COUNT; frame++) {
        display_success_warp_frame(frame);
        vTaskDelay(pdMS_TO_TICKS(67));
    }
}

void display_success_check_animation(void)
{
    if (!display_connected) return;
    for (uint8_t frame = 0; frame < OLED_SUCCESS_CHECK_FRAME_COUNT; frame++) {
        display_success_check_frame(frame);
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void display_success_screen(const char *amount, const char *symbol, const char *address)
{
    char amount_line[32];
    char address_line[24];
    snprintf(amount_line, sizeof(amount_line), "%s %s", amount ? amount : "", symbol ? symbol : "TOKEN");
    if (address != NULL && strlen(address) >= 12) {
        snprintf(address_line, sizeof(address_line), "%.8s...%.6s", address, address + strlen(address) - 6);
    } else {
        snprintf(address_line, sizeof(address_line), "Wallet ready");
    }
    memset(display_buffer, 0, sizeof(display_buffer));
    draw_final_checkmark_top();
    draw_small_line(amount_line, 21);
    draw_small_line(address_line, 34);
    (void)flush_display_buffer();
}
