const express = require('express')
const fs = require('fs')
const path = require('path')
const { sendMessage } = require('./utils')
const { conectar_instance, desconectar_instance } = require('./services/zapfy/instance')



try {
    let port = process.env.PORT || 3000
    const app = express()
    // app.use(express.limit(100000000));
    app.use(express.urlencoded({ extended: false, limit: '50mb' }))
    app.use(express.json({ limit: '50mb' }));
    app.use(express.static('pages'))

    app.get('/', (req, res) => {
        return res.sendFile(path.join(__dirname, '/pages/home.html'))
    })

    app.get('/qr-code', (req, res) => {
        let { idCliente } = req.query
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        try {
            return res.json({
                nome_qrcode: (config[idCliente].nome_qrcode || false),
                autenticado: (config[idCliente].autenticado || false)
            })
        } catch (e) {
            return res.json({
                nome_qrcode: false,
                autenticado: false
            })
        }
    })

    app.post('/check-user-conect', async (req, res) => {
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        if ( config.instancia_conectada ) {
            return res.json({ status: 'connected' })
        }
        return res.json({ status: 'disconnected' })
    })

    app.post('/iniciar-sessao', async (req, res) => {
        let resultado = await conectar_instance()
        return res.json({resultado})
    })

    app.post('/fechar-sessao', async (req, res) => {
        let disconnect = await desconectar_instance()
        if ( !disconnect.erro ) {
            return disconnect.state
        }
    })

    /**
     *  rota para recebimento das mensagens whatsapp
     */

    app.post('/new-message', async (req, res) => {
        console.log('\n-------INÍCIO ---------\n\n--------------- 1 =>', req.body)
        try{
            console.log('--------------- 2 =>', req.body.data)
        }catch(e){}
        try{
            console.log('--------------- 3 =>', req.body.data.message.extendedTextMessage.text, '\n\n----- FIM ----------\n\n')
        }catch(e){}
        
        if ( req.body.type == "NEW-MESSAGE" ) {
            if ( req.body.data && req.body.data.key.remoteJid.toString().includes('@g.us') && typeof req.body.data.message.extendedTextMessage != 'undefined' ) {
                await sendMessage(req.body) 
            }
        }
        if ( req.body.type == 'INSTANCE-CONNECTED' ) {
            let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
            config.instancia_conectada = true
            fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
        }
        if ( req.body.type == 'INSTANCE-DISCONNECTED' ) {
            let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
            config.instancia_conectada = false
            fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
        }
        return res.status(200).send({receiver: "OK"})
    })

    app.listen(port, () => { console.log('Rodando as rotas na porta: ' + port) })

    process.on('SIGINT', (e) => { console.log(e); process.exit() })
    process.on('SIGQUIT', (e) => { console.log(e); process.exit() })
    process.on('SIGTERM', (e) => { console.log(e); process.exit() })
    process.on('exit', (code) => {
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
        console.log('Fechando o processo com o código: ', code);
    });
} catch (e) {
    process.on('SIGINT', (e) => { console.log(e); process.exit() })
    process.on('SIGQUIT', (e) => { console.log(e); process.exit() })
    process.on('SIGTERM', (e) => { console.log(e); process.exit() })
    process.on('exit', (code) => {
        let config = JSON.parse(fs.readFileSync(path.join(__dirname, '/config.json')))
        fs.writeFileSync(path.join(__dirname, '/config.json'), JSON.stringify(config))
        console.log('Fechando o processo com o código: ', code);
    });
}


function formatarValor(valor, depoisVirgula=false) {
    if ( depoisVirgula ) var minimumFractionDigits = 2
    else var minimumFractionDigits = 0
    return valor.toLocaleString('pt-BR', { minimumFractionDigits });
}
