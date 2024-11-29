const fs = require("fs")
const { 
    google_infos_clientes, google_include_cliente, 
    google_salvar_transacao, google_cancelar_transacao, google_info_conta_banco, google_consulta_escrita_dados_bd
} = require("./services/google")
const { get_cotas_usdt } = require("./services/traceCapital")
var { infoClientesTemp, intervalClientes, countInterval} = require("./conexaoClienteCache")
const { zapfySendMessage } = require("./services/zapfy/message")

var interval = null
module.exports = {
    deletarArquivo: (path) => {
        if ( fs.existsSync(path)) { fs.unlinkSync(path); return true }
        else return false
    },
    sendMessage: async (msg) => {
        console.log('\n\nmessage de ' + msg.data.participant + ' para ' + msg.data.key.remoteJid + ' com a msg => ' + msg.data.message.extendedTextMessage.text)
        var participant = ""
        if ( msg.data.participant.toString().includes(':') ) {
            participant = msg.data.participant.toString().split(':')[0]
        }
        if ( participant == "" && msg.data.participant.toString().includes('@') ) {
            participant = msg.data.participant.toString().split('@')[0]
        }
        
        // verifica se a variável já está armazenando os dados do cliente, senão armazena pra não ficar a tdo momento buscando as informações
        if ( !infoClientesTemp ) { 
            let response = await google_infos_clientes() 
            if ( !response.erro ) infoClientesTemp = response.data
        }
        // verifica se o id do grupo está no .from ou .to e seta
        if ( msg.data.key.remoteJid.includes('@g.us') ) { var id_grupo = msg.data.key.remoteJid }
        // else { var id_grupo = msg.to }

        // verifica de a mensagem está vindo de um grupo, senão para por aqui mesmo
        if ( !id_grupo.includes("@g.us") ) { console.log('Não veio como grupo = ', msg.data.key.remoteJid); return true }

        // comando para habilitar algum numero que foi inserido e não tinha acesso
        if ( msg.data.message.extendedTextMessage.text == "/lpu" ) {
            let resp = await google_infos_clientes() 
            if ( !resp.erro ) {
                infoClientesTemp = resp.data
                return await zapfySendMessage(id_grupo, "Liberação para usar comandos feita com sucesso.")
            }
            return await zapfySendMessage(id_grupo, "Houve um erro ao liberar o uso dos comandos.")
        }

        // inclui novo grupo na planilha e busca os dados do cliente para atualizar na variável cache => [infoClientesTemp]
        if ( msg.data.message.extendedTextMessage.text.includes('/include') ) {
            let taxa = msg.data.message.extendedTextMessage.text.split(" ")[1]
            let include = await google_include_cliente(id_grupo, taxa, participant+"@c.us")
            if ( include.resultado == "OK" ) {
                let res = await google_infos_clientes() 
                if ( !res.erro ) infoClientesTemp = res.data  
                return await zapfySendMessage(id_grupo, "Grupo incluído na planilha com sucesso!")
            }else {
                return await zapfySendMessage(id_grupo, "Houve um erro ao incluir o id do grupo, tente novamnete.")
            }            
        }
        if ( typeof infoClientesTemp[id_grupo] != 'undefined' && infoClientesTemp[id_grupo].numero_comandos.includes(participant+"@c.us") ) {
            var id_grupo_author = `${id_grupo}_${msg.data.participant}`
            if ( msg.data.message.extendedTextMessage.text == "/ref" ) {
                countInterval[id_grupo_author] = 1
                intervalClientes[id_grupo_author] = setInterval(async () => {
                    let cota = await get_cotas_usdt()
                    if ( countInterval[id_grupo_author] == 9 && typeof intervalClientes[id_grupo_author] != 'undefined' ) {
                        clearInterval(intervalClientes[id_grupo_author])
                        delete countInterval[id_grupo_author]
                        await zapfySendMessage(id_grupo, "off")
                        delete intervalClientes[id_grupo_author]  /// verificar pois pode estar travando a mensagem d e duas pessoas do mesmo grupo 
                        return true
                    }
                    if ( !cota.erro ) {
                        let constanteProjeto = 0.5067
                        let taxaFixaOperacao = parseFloat(( constanteProjeto * parseFloat(cota.cota).toFixed(4) ) / 100)
                        let cotaMenosTaxaFixa = parseFloat( parseFloat(cota.cota).toFixed(4) - taxaFixaOperacao ).toFixed(4)
                        let taxa = parseFloat( ( infoClientesTemp[id_grupo].taxa * cotaMenosTaxaFixa ) / 100 ).toFixed(4)
                        let cota_taxa = parseFloat( parseFloat(cotaMenosTaxaFixa) + parseFloat(taxa) ).toFixed(4)
                        await zapfySendMessage(id_grupo, `VALOR USDT = R$${parseFloat(cota_taxa).toFixed(4).toString().replace('.', ',')}`)
                        countInterval[id_grupo_author]++
                    }else {
                        await zapfySendMessage(id_grupo, "A api está com instabilidade no momento.")
                        delete intervalClientes[id_grupo_author]
                        delete countInterval[id_grupo_author]
                        return true
                    }
                }, 4000)
            }
            else if ( msg.data.message.extendedTextMessage.text == "." ) {
                clearInterval(intervalClientes[id_grupo_author])
                delete intervalClientes[id_grupo_author]
                delete countInterval[id_grupo_author]
                return true
            }
            else if ( msg.data.message.extendedTextMessage.text.includes("/order") && msg.data.message.extendedTextMessage.text[0] == "/" && msg.data.message.extendedTextMessage.text.split(" ").length == 5 && msg.data.message.extendedTextMessage.text.includes(" fx ") && operacao(msg) ) {
                let msgBodySplit = msg.data.message.extendedTextMessage.text.split(' ')
                let dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).slice(0, 20).split('-').reverse().join('/').split(', ')
                let data = dataHora[0]
                let hora = dataHora[1]
                if ( msgBodySplit[1].includes('k') || msgBodySplit[1].includes('K') ) {
                    var qtdeTotal = formatarValor(parseFloat(msgBodySplit[1].replace('k', '').replace('K', '')) * 1000, true)
                    var usdtPlanilha = qtdeTotal
                }else {
                    var qtdeTotal = msgBodySplit[1]
                    if ( !qtdeTotal.includes(',') ) {
                        qtdeTotal = parseFloat(qtdeTotal.toString().replace('.', ''))
                    }
                    var usdtPlanilha = formatarValor(qtdeTotal, true)
                }
                let cota = parseFloat( parseFloat(msgBodySplit[3].replace(',', '.')) ).toFixed(4)
                let venda =  formatarValor(parseFloat(cota * parseFloat(qtdeTotal.toString().replace('.', ''))), true)
                let hash = criarHash()
                await zapfySendMessage(id_grupo, `_Detalhes da Operação_:

*Id operação:* ${hash}
📅 *Data da Operação:* ${data}
*Hora:* ${hora}

*Cotação:* 1 USDT = R$ ${(cota).toString().replace('.', ',')} BRL

💵 *Montante em USDT:* ${formatarValor(qtdeTotal, true)}
💼 *Montante em BRL:* R$${formatarValor(venda, true)}`)
                let cliente = infoClientesTemp[id_grupo].nome_grupo
                let fluxo = msgBodySplit[4]
                let res = await google_salvar_transacao({
                    data,
                    hora,
                    cliente,
                    fluxo,
                    usdt: usdtPlanilha.toString(),
                    venda: cota.toString().replace('.', ','),
                    id_operacao: hash
                })
                if ( res.erro ) {
                    setTimeout(async function(){
                        res = await google_salvar_transacao({
                            data,
                            hora,
                            cliente,
                            fluxo,
                            usdt: usdtPlanilha.toString(),
                            venda: cota.toString().replace('.', ','),
                            id_operacao: hash
                        })
                        if ( res.erro ) await zapfySendMessage(participant, `Erro ao salvar a transação [ ${hash} ] no banco de dados.`)
                    }, 6000)
                }else {
                    setTimeout(async function(){
                        let escrita = await google_consulta_escrita_dados_bd(infoClientesTemp[id_grupo].nome_grupo)
                        console.log(escrita)
                        if ( typeof escrita.dados_escrita[hash] == 'undefined' ) {
                            res = await google_salvar_transacao({
                                data,
                                hora,
                                cliente,
                                fluxo,
                                usdt: usdtPlanilha.toString(),
                                venda: cota.toString().replace('.', ','),
                                id_operacao: hash
                            })
                            if ( res.erro ) {
                                setTimeout(async function(){
                                    let res = await google_salvar_transacao({
                                        data,
                                        hora,
                                        cliente,
                                        fluxo,
                                        usdt: usdtPlanilha.toString(),
                                        venda: cota.toString().replace('.', ','),
                                        id_operacao: hash
                                    })
                                    if ( res.erro ) await zapfySendMessage(participant, `Erro ao salvar a transação [ ${hash} ] no banco de dados.`)
                                }, 6000)
                                
                            }
                        }
                    }, 12000)
                }
            }
            else if ( msg.data.message.extendedTextMessage.text.includes("/cancel") ) {
                if ( msg.data.message.extendedTextMessage.text.split(' ').length == 1 ) { return await zapfySendMessage(participant, "Envie o id da transação.") }
                let resultado = await google_cancelar_transacao(msg.data.message.extendedTextMessage.text.split(' ')[1].trim())
                if ( resultado.cancelou ) {
                    await zapfySendMessage(participant, "A transação foi cancelada.")
                }else {
                    await zapfySendMessage(participant, "Houve um problema ao cancelar a transação.")
                }
            }
            else if ( msg.data.message.extendedTextMessage.text == "/att" ) {
                let info = await google_infos_clientes() 
                if ( !info.erro ) {
                    infoClientesTemp = info.data
                    await zapfySendMessage(participant, "Atualização dos dados da planilha feito com sucesso.")
                }else { await zapfySendMessage(participant, "Houve um erro ao atualizar os dados da planilha no bot") }
            }
            else if ( msg.data.message.extendedTextMessage.text.includes("/banco") ) {
                let resultado = await google_info_conta_banco(msg.data.message.extendedTextMessage.text.split(' ')[1].trim())
                if ( !resultado.erro  ) {
                    await zapfySendMessage(id_grupo, `*Banco:* ${ resultado.conta_banco.nome_banco }
*Ag:* ${ resultado.conta_banco.agencia }
*Conta Corrente:* ${ resultado.conta_banco.conta_corrente }
*EMPRESA:* ${ resultado.conta_banco.nome_empresa }
*CNPJ:* ${ resultado.conta_banco.cnpj }
*Pix:* ${ resultado.conta_banco.chave_pix }`)
                }
            }
            else if ( msg.data.message.extendedTextMessage.text.includes("/help") ) {
                let helpSplit = msg.data.message.extendedTextMessage.text.split(" ")
                if ( helpSplit.length == 2 ) var comandos = todosComandos(helpSplit[1])
                else var comandos = todosComandos()
                if ( !comandos ) return await zapfySendMessage(id_grupo, "Não existe comando com esse número.")
                await zapfySendMessage(participant, comandos)
                await zapfySendMessage(id_grupo, "comandos enviado no privado.")
            } 
        }
    }
}

function criarHash() {
    const caracteres = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';
    
    let hash = '';
    
    for (let i = 0; i < 2; i++) {
      hash += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    
    for (let i = 0; i < 2; i++) {
      hash += numeros.charAt(Math.floor(Math.random() * numeros.length));
    }
    
    return hash;
}
function operacao(msg) {
    if ( msg.data.message.extendedTextMessage.text.includes("D0") || msg.data.message.extendedTextMessage.text.includes("d0") ) return true
    if ( msg.data.message.extendedTextMessage.text.includes("D1") || msg.data.message.extendedTextMessage.text.includes("d1") ) return true
    if ( msg.data.message.extendedTextMessage.text.includes("D2") || msg.data.message.extendedTextMessage.text.includes("d2") ) return true
    return false
}
function formatarValor(valor, depoisVirgula=false) {
    if ( depoisVirgula ) var minimumFractionDigits = 2
    else var minimumFractionDigits = 0
    return valor.toLocaleString('pt-BR', { minimumFractionDigits });
}
function todosComandos(id=false) {
    let comandos = {
        "1": `*[1]* Incluir um novo grupo na planilha para liberação dos comandos
*composição do comando:* /include + 1 espaço + taxa do cliente
*exemplo:* /include 0,90`,
        "2": `*[2]* Excluir transação gravada na planilha
*composição do comando:* /cancel + 1 espaço + número da transação
*exemplo:* /cancel 123`,
        "3": `*[3]* Buscar cota e entregar informação com no máximo 5 recebimentos de cota
*composição do comando:* /ref
*exemplo:* /ref`,
        "4": `*[4]* Parar loop da buscar de cota
*composição do comando:* .
*exemplo:* .`,
        "5": `*[5]* Gerar a venda
*composição do comando:* /order + espaço + qtde pedida + espaço + fx + espaço + cota + espaço + operação
*exemplo:* /order 10k fx 5,0329 D0`,
        "6": `*[6]* Liberar primeiro uso de numero que foi inserido para enviar comandos ao bot
*composição do comando:* /lpu
*exemplo:* /lpu`,
        "7": `*[7]* Atualizar dados dos grupos em cache que eventualmente tiveram mudanças
*composição do comando:* /att
*exemplo:* /att`,
        "8": `*[8]* Buscar dados bancários
*composição do comando:* /banco + espaço + id do banco
*exemplo:* /banco 123`,
        '9': `*[9]* Listar todos os comandos disponíveis
*composição do comando:* /help
*exemplo:* /help`,
        "10": `*[10]* Listar comando específico disponível
*composição do comando:* /help + espaço + numero do comando
*exemplo:* /help 1`
    }
    if ( id && id > Object.keys(comandos).length ) return false
    if ( id ) return comandos[id]
    let ultimoItem = `[${ Object.keys(comandos).length }]`
    let listaComandos = ""
    for ( let comando of Object.values(comandos) ) {
        if ( comando.includes(ultimoItem) ) {
            listaComandos += comando
        }else listaComandos += (comando + '\n\n')
    }
    return listaComandos
}


