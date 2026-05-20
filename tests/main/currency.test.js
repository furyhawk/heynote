import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import pkg from "../../package.json"
import { CURRENCY_RATES_URL } from "../../src/common/currency-request.js"

const clientId = "0123456789ABCDEFGHIJKL"
const configSetMock = vi.fn()

vi.mock("../../electron/config.js", () => ({
    default: {
        get: vi.fn((key) => {
            if (key === "clientId") {
                return clientId
            }
            return undefined
        }),
        set: (...args) => configSetMock(...args),
    },
}))

describe("getCurrencyData", () => {
    beforeEach(() => {
        vi.resetModules()
        configSetMock.mockClear()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("sends client headers when fetching exchange rates", async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            text: async () => JSON.stringify({base: "USD", rates: {EUR: 0.9}}),
        }))
        vi.stubGlobal("fetch", fetchMock)

        const { default: getCurrencyData } = await import("../../electron/preload/currency.ts")
        await getCurrencyData()

        expect(fetchMock).toHaveBeenCalledWith(CURRENCY_RATES_URL, {
            cache: "no-cache",
            headers: {
                "x-client-id": clientId,
                "x-client-version": pkg.version,
            },
        })
    })
})
