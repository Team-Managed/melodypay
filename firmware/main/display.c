#include "display.h"

#include "esp_log.h"

static const char *TAG = "display";

esp_err_t display_init(void)
{
    // The SSD1306 transport is intentionally isolated here. Add the selected
    // controller driver before enabling production firmware builds.
    ESP_LOGW(TAG, "SSD1306 driver not wired yet; messages are serial-only");
    return ESP_OK;
}

void display_message(const char *line1, const char *line2, const char *line3, const char *line4)
{
    ESP_LOGI(TAG, "%s | %s | %s | %s", line1 ? line1 : "", line2 ? line2 : "", line3 ? line3 : "", line4 ? line4 : "");
}
