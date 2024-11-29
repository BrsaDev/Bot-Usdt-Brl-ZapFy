const axios = require("axios")


const instanceKey = "2fdee70d-79ef-4b08-b074-c32c2cd0d30f"
const instanceToken = "baa0ce87-7507-4806-908e-57277c6e3017"
const baseUrl = `https://api.zapfy.me/v1/instance/${instanceKey}/token/${instanceToken}`
module.exports = {
    conectar_instance: async () => {
        try {
            let url = `${baseUrl}/connect`
            let qr = await axios.post(url)
            return qr.data.result
        }catch(erro) {
            return {erro}
        }
    },
    desconectar_instance: async () => {
        try {
            let url = `${baseUrl}/disconnect`
            let disconnect = await axios.post(url)
            return disconnect.data.result
        }catch(erro) {
            return {erro}
        }
    },
    status_instance: async () => {
        try {
            let url = `${baseUrl}/getState`
            let qr = await axios(url)
            return qr.data.result
        }catch(erro) {
            return {erro}
        }
        
    }
}



