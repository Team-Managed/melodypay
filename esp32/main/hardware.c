#include "hardware.h"

#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"

static const char *TAG = "hardware";
static i2s_chan_handle_t mic_channel;
static i2s_chan_handle_t amp_channel;
static bool audio_available;

static esp_err_t init_buttons(void)
{
    const gpio_config_t config = {
        .pin_bit_mask = (1ULL << MELODY_APPROVE_GPIO) | (1ULL << MELODY_REJECT_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    return gpio_config(&config);
}

#if !CONFIG_MELODY_BARE_BOARD_DIAGNOSTIC
static esp_err_t init_microphone(void)
{
    i2s_chan_config_t channel_config = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    channel_config.dma_desc_num = 8;
    channel_config.dma_frame_num = 256;
    ESP_RETURN_ON_ERROR(i2s_new_channel(&channel_config, NULL, &mic_channel), TAG, "mic channel");

    i2s_std_config_t config = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(MELODY_SAMPLE_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = MELODY_MIC_BCLK_GPIO,
            .ws = MELODY_MIC_WS_GPIO,
            .dout = I2S_GPIO_UNUSED,
            .din = MELODY_MIC_DATA_GPIO,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv = false,
            },
        },
    };
    config.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;
    ESP_RETURN_ON_ERROR(i2s_channel_init_std_mode(mic_channel, &config), TAG, "mic mode");
    ESP_RETURN_ON_ERROR(i2s_channel_enable(mic_channel), TAG, "mic enable");
    return ESP_OK;
}

static esp_err_t init_amplifier(void)
{
    i2s_chan_config_t channel_config = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
    channel_config.dma_desc_num = 8;
    channel_config.dma_frame_num = 256;
    ESP_RETURN_ON_ERROR(i2s_new_channel(&channel_config, &amp_channel, NULL), TAG, "amp channel");

    i2s_std_config_t config = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(MELODY_SAMPLE_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = MELODY_AMP_BCLK_GPIO,
            .ws = MELODY_AMP_LRC_GPIO,
            .dout = MELODY_AMP_DATA_GPIO,
            .din = I2S_GPIO_UNUSED,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv = false,
            },
        },
    };
    ESP_RETURN_ON_ERROR(i2s_channel_init_std_mode(amp_channel, &config), TAG, "amp mode");
    ESP_RETURN_ON_ERROR(i2s_channel_enable(amp_channel), TAG, "amp enable");
    return ESP_OK;
}
#endif

esp_err_t hardware_init(void)
{
    ESP_RETURN_ON_ERROR(init_buttons(), TAG, "buttons");
#if CONFIG_MELODY_BARE_BOARD_DIAGNOSTIC
    ESP_LOGW(TAG, "bare-board diagnostic mode: skipping I2S microphone and amplifier");
    audio_available = false;
    return ESP_OK;
#else
    ESP_RETURN_ON_ERROR(init_microphone(), TAG, "microphone");
    ESP_RETURN_ON_ERROR(init_amplifier(), TAG, "amplifier");
    audio_available = true;
    ESP_LOGI(TAG, "audio and button hardware initialized");
    return ESP_OK;
#endif
}

bool hardware_audio_available(void)
{
    return audio_available;
}

esp_err_t hardware_read_mic(int32_t *samples, size_t sample_count, size_t *samples_read, uint32_t timeout_ms)
{
    if (mic_channel == NULL) return ESP_ERR_NOT_SUPPORTED;
    size_t bytes_read = 0;
    esp_err_t result = i2s_channel_read(mic_channel, samples, sample_count * sizeof(int32_t), &bytes_read, timeout_ms);
    if (samples_read != NULL) *samples_read = bytes_read / sizeof(int32_t);
    return result;
}

esp_err_t hardware_play_pcm(const int16_t *samples, size_t sample_count)
{
    if (amp_channel == NULL) return ESP_ERR_NOT_SUPPORTED;
    size_t bytes_written = 0;
    return i2s_channel_write(amp_channel, samples, sample_count * sizeof(int16_t), &bytes_written, portMAX_DELAY);
}

void hardware_mute_mic(void)
{
    if (mic_channel != NULL) (void)i2s_channel_disable(mic_channel);
}

void hardware_unmute_mic(void)
{
    if (mic_channel != NULL) (void)i2s_channel_enable(mic_channel);
}

bool hardware_approve_pressed(void)
{
    return gpio_get_level(MELODY_APPROVE_GPIO) == 0;
}

bool hardware_reject_pressed(void)
{
    return gpio_get_level(MELODY_REJECT_GPIO) == 0;
}
