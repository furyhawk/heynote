const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
const CLIENT_ID_LENGTH = 22
const CLIENT_ID_BYTES = 16

export const TEST_CLIENT_ID = "testing"

function getRandomBytes(length) {
    const bytes = new Uint8Array(length)
    globalThis.crypto.getRandomValues(bytes)
    return bytes
}

export function generateClientId(randomBytes = getRandomBytes(CLIENT_ID_BYTES)) {
    let value = 0n
    let id = ""

    for (const byte of randomBytes) {
        value = (value << 8n) + BigInt(byte)
    }

    do {
        id = BASE62_ALPHABET[Number(value % 62n)] + id
        value /= 62n
    } while (value > 0n)

    return id.padStart(CLIENT_ID_LENGTH, BASE62_ALPHABET[0])
}
