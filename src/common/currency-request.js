export const CURRENCY_RATES_URL = "https://currencies.heynote.com/rates.json"

export function getCurrencyFetchOptions(clientId, version) {
    return {
        cache: "no-cache",
        headers: {
            "x-client-id": clientId,
            "x-client-version": version,
        },
    }
}
