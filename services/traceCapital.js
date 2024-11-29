const axios = require('axios')

let baseUrlDev = "https://trade.capstg.dev/api"
let baseUrl = "https://trade.capitual.io/api"

const user = ""
const pass = ""
const user_dev = ""
const pass_dev = ""

module.exports = {
    get_cotas_usdt: async () => {
        try {
            const options = {
                headers: {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'},
                auth: {
                    username: user,
                    password: pass
                }
            }
            let response = await axios.get(baseUrl+"/v1.0/trades/quotation?pair=USDT", options)
            console.log(response.data)
            return { cota: response.data.data.fx_rate, erro: false }
        } catch (erro) {
            console.log(erro)
            return { erro }
        }
    }
}

