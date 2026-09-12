#include "keccak.h"

#include <string.h>

#define KECCAK_RATE 136u

static const uint64_t round_constants[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL,
    0x800000000000808aULL, 0x8000000080008000ULL,
    0x000000000000808bULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL,
    0x000000000000008aULL, 0x0000000000000088ULL,
    0x0000000080008009ULL, 0x000000008000000aULL,
    0x000000008000808bULL, 0x800000000000008bULL,
    0x8000000000008089ULL, 0x8000000000008003ULL,
    0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800aULL, 0x800000008000000aULL,
    0x8000000080008081ULL, 0x8000000000008080ULL,
    0x0000000080000001ULL, 0x8000000080008008ULL,
};

static const uint8_t rotation_offsets[25] = {
     0,  1, 62, 28, 27,
    36, 44,  6, 55, 20,
     3, 10, 43, 25, 39,
    41, 45, 15, 21,  8,
    18,  2, 61, 56, 14,
};

static uint64_t rotate_left(uint64_t value, uint8_t count)
{
    return count == 0 ? value : (value << count) | (value >> (64u - count));
}

static uint64_t load_le64(const uint8_t *input)
{
    uint64_t value = 0;
    for (size_t index = 0; index < 8; index++) value |= (uint64_t)input[index] << (index * 8u);
    return value;
}

static void store_le64(uint8_t *output, uint64_t value)
{
    for (size_t index = 0; index < 8; index++) output[index] = (uint8_t)(value >> (index * 8u));
}

static void keccak_f1600(uint64_t state[25])
{
    for (size_t round = 0; round < 24; round++) {
        uint64_t column_parity[5];
        uint64_t column_delta[5];
        uint64_t rotated[25];
        uint64_t permuted[25];

        for (size_t x = 0; x < 5; x++) {
            column_parity[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
        }
        for (size_t x = 0; x < 5; x++) {
            column_delta[x] = column_parity[(x + 4) % 5] ^ rotate_left(column_parity[(x + 1) % 5], 1);
        }
        for (size_t x = 0; x < 5; x++) {
            for (size_t y = 0; y < 5; y++) state[x + 5 * y] ^= column_delta[x];
        }

        for (size_t x = 0; x < 5; x++) {
            for (size_t y = 0; y < 5; y++) {
                rotated[y + 5 * ((2 * x + 3 * y) % 5)] =
                    rotate_left(state[x + 5 * y], rotation_offsets[x + 5 * y]);
            }
        }
        for (size_t x = 0; x < 5; x++) {
            for (size_t y = 0; y < 5; y++) {
                permuted[x + 5 * y] = rotated[x + 5 * y] ^
                    ((~rotated[(x + 1) % 5 + 5 * y]) & rotated[(x + 2) % 5 + 5 * y]);
            }
        }
        memcpy(state, permuted, sizeof(permuted));
        state[0] ^= round_constants[round];
    }
}

void evm_keccak256(const uint8_t *input, size_t length, uint8_t output[32])
{
    uint64_t state[25] = {0};
    uint8_t block[KECCAK_RATE];

    while (length >= KECCAK_RATE) {
        for (size_t index = 0; index < KECCAK_RATE / 8; index++) state[index] ^= load_le64(input + index * 8);
        keccak_f1600(state);
        input += KECCAK_RATE;
        length -= KECCAK_RATE;
    }

    memset(block, 0, sizeof(block));
    if (length > 0 && input != NULL) memcpy(block, input, length);
    block[length] ^= 0x01;
    block[KECCAK_RATE - 1] ^= 0x80;
    for (size_t index = 0; index < KECCAK_RATE / 8; index++) state[index] ^= load_le64(block + index * 8);
    keccak_f1600(state);
    for (size_t index = 0; index < 4; index++) store_le64(output + index * 8, state[index]);
}
