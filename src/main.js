import './css/application.sass'
import '../assets/font/open-sans/open-sans.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config';

import App from './components/App.vue'
import { DEFAULT_LEFT_PANEL_WIDTH } from './common/constants.js'
import { loadCurrencies } from './currency'
import { useErrorStore } from './stores/error-store'
import { initHeynoteStore } from './stores/heynote-store'


// Set before Vue mounts so CSS using the variable has a default on first paint.
document.documentElement.style.setProperty("--left-panel-width", `${DEFAULT_LEFT_PANEL_WIDTH}px`)

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(PrimeVue)
app.mount('#app').$nextTick(() => {
    // hide loading screen
    postMessage({ payload: 'removeLoading' }, '*')
})

const errorStore = useErrorStore()
//errorStore.addError("test error")
window.heynote.getInitErrors().then((errors) => {
    errors.forEach((e) => errorStore.addError(e))
})

initHeynoteStore()



// load math.js currencies
loadCurrencies()
setInterval(loadCurrencies, 1000 * 3600 * 4)

window.heynote.init()
