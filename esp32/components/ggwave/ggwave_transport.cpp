#include "ggwave_transport.h"

#include <cstring>
#include <cstdlib>

#include "ggwave/ggwave.h"

namespace {

// Keep the protocol waveform below the small bench speaker's clipping point.
constexpr int kGgwaveVolume = 25;
GGWave wave;
bool initialized = false;

esp_err_t prepare(void)
{
    if (initialized) return ESP_OK;

    GGWave::setLogFile(nullptr);
    auto parameters = GGWave::getDefaultParameters();
    // Fixed-length mode keeps the ESP32's full-waveform buffers within PSRAM.
    // The wrapper stores the actual length in byte zero of this fixed frame.
    parameters.payloadLength = GGWAVE_TRANSPORT_PAYLOAD_BYTES;
    parameters.sampleRateInp = 48000.0f;
    parameters.sampleRateOut = 48000.0f;
    parameters.sampleRate = 48000.0f;
    parameters.samplesPerFrame = 512;
    parameters.sampleFormatInp = GGWAVE_SAMPLE_FORMAT_I16;
    parameters.sampleFormatOut = GGWAVE_SAMPLE_FORMAT_I16;
    parameters.operatingMode = GGWAVE_OPERATING_MODE_RX_AND_TX;

    GGWave::Protocols::tx().disableAll();
    GGWave::Protocols::tx().toggle(GGWAVE_PROTOCOL_AUDIBLE_FASTEST, true);
    GGWave::Protocols::rx().disableAll();
    GGWave::Protocols::rx().toggle(GGWAVE_PROTOCOL_AUDIBLE_FASTEST, true);

    initialized = wave.prepare(parameters, true);
    return initialized ? ESP_OK : ESP_ERR_NO_MEM;
}

bool init_payload(const uint8_t *payload, size_t payload_size)
{
    if (payload == nullptr || payload_size == 0 || payload_size >= GGWAVE_TRANSPORT_PAYLOAD_BYTES) return false;
    if (prepare() != ESP_OK) return false;

    uint8_t frame[GGWAVE_TRANSPORT_PAYLOAD_BYTES] = {0};
    frame[0] = static_cast<uint8_t>(payload_size);
    std::memcpy(frame + 1, payload, payload_size);
    return wave.init(GGWAVE_TRANSPORT_PAYLOAD_BYTES, reinterpret_cast<const char *>(frame),
                     GGWAVE_PROTOCOL_AUDIBLE_FASTEST, kGgwaveVolume);
}

} // namespace

extern "C" esp_err_t ggwave_transport_init(void)
{
    return prepare();
}

extern "C" size_t ggwave_transport_encode_size(const uint8_t *payload, size_t payload_size)
{
    if (!init_payload(payload, payload_size)) return 0;
    return wave.encodeSize_samples();
}

extern "C" int ggwave_transport_encode(const uint8_t *payload, size_t payload_size,
                                         int16_t *samples, size_t sample_capacity)
{
    if (samples == nullptr || !init_payload(payload, payload_size)) return -1;

    const size_t required = wave.encodeSize_samples();
    if (sample_capacity < required) return -static_cast<int>(required);

    const uint32_t encoded_bytes = wave.encode();
    const size_t encoded_samples = encoded_bytes / sizeof(int16_t);
    if (encoded_samples > sample_capacity) return -static_cast<int>(encoded_samples);
    std::memcpy(samples, wave.txWaveform(), encoded_bytes);
    return static_cast<int>(encoded_samples);
}

extern "C" int ggwave_transport_decode(const int16_t *samples, size_t sample_count,
                                         uint8_t *payload, size_t payload_capacity)
{
    if (samples == nullptr || payload == nullptr || payload_capacity == 0 || prepare() != ESP_OK) return -1;
    if (!wave.decode(samples, static_cast<uint32_t>(sample_count * sizeof(int16_t)))) return 0;

    GGWave::TxRxData received;
    const int received_size = wave.rxTakeData(received);
    if (received_size != GGWAVE_TRANSPORT_PAYLOAD_BYTES) return 0;

    const size_t decoded_size = received[0];
    if (decoded_size == 0 || decoded_size >= GGWAVE_TRANSPORT_PAYLOAD_BYTES) return 0;
    if (decoded_size > payload_capacity) return -static_cast<int>(decoded_size);
    std::memcpy(payload, received.data() + 1, decoded_size);
    return static_cast<int>(decoded_size);
}

extern "C" int ggwave_transport_self_test(void)
{
    static const uint8_t expected[] = {'h', 'e', 'l', 'l', 'o'};
    const size_t sample_count = ggwave_transport_encode_size(expected, sizeof(expected));
    if (sample_count == 0) return -1;

    auto *waveform = static_cast<int16_t *>(std::malloc(sample_count * sizeof(int16_t)));
    if (waveform == nullptr) return -2;
    const int encoded = ggwave_transport_encode(expected, sizeof(expected), waveform, sample_count);
    uint8_t decoded[GGWAVE_TRANSPORT_PAYLOAD_BYTES] = {0};
    const int decoded_size = encoded > 0
        ? ggwave_transport_decode(waveform, static_cast<size_t>(encoded), decoded, sizeof(decoded))
        : -3;
    std::free(waveform);

    if (decoded_size != static_cast<int>(sizeof(expected)) ||
        std::memcmp(decoded, expected, sizeof(expected)) != 0) return -4;
    return 0;
}
